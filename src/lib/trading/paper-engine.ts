// ─────────────────────────────────────────────────────────────
// Paper Trading Engine — simulación realista sin dinero real
// · Cuenta con cash y balance inicial
// · Órdenes market (fill inmediato con slippage) y limit (pendientes)
// · Posiciones long/short con SL/TP
// · PnL realizado, comisiones y validación por Risk Engine
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import { getPrice } from '@/lib/market/data'
import { validateEntry, logRiskEvent } from '@/lib/risk/risk-engine'
import { remember, learnFromOutcome } from '@/lib/memory/agent-memory'

const COMMISSION_RATE = 0.001 // 0.1% tipo Binance spot
const SLIPPAGE_RATE = 0.0005  // 0.05%

export async function ensureAccount(): Promise<{ id: string; cash: number; startingBalance: number; baseCurrency: string; name: string }> {
  let account = await db.paperAccount.findFirst()
  if (!account) {
    const starting = Number(process.env.NEXUS_PAPER_START ?? 10000)
    account = await db.paperAccount.create({
      data: { name: 'Cuenta Principal', startingBalance: starting, cash: starting },
    })
  }
  return { id: account.id, cash: account.cash, startingBalance: account.startingBalance, baseCurrency: account.baseCurrency, name: account.name }
}

export interface PlaceOrderInput {
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  qty?: number
  usdAmount?: number
  limitPrice?: number
  stopLoss?: number
  takeProfit?: number
  source: 'manual' | 'agent' | 'risk' | 'killswitch'
  skipRiskCheck?: boolean
}

export interface PlaceOrderResult {
  ok: boolean
  orderId?: string
  positionId?: string
  message: string
  details?: Record<string, unknown>
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const account = await ensureAccount()
  const symbol = input.symbol.toUpperCase()
  const price = await getPrice(symbol)
  if (!price || price <= 0) return { ok: false, message: `No hay precio disponible para ${symbol}` }

  const fillPrice = input.type === 'limit' && input.limitPrice
    ? input.limitPrice
    : price * (1 + (input.side === 'buy' ? 1 : -1) * SLIPPAGE_RATE)

  // cantidad: directa o derivada de monto USDT
  let qty = input.qty ?? (input.usdAmount ? input.usdAmount / fillPrice : 0)
  if (!qty || qty <= 0) return { ok: false, message: 'Cantidad inválida' }

  const isLong = input.side === 'buy'
  const existingLong = await db.paperPosition.findFirst({ where: { accountId: account.id, symbol, side: 'long', status: 'open' } })
  const existingShort = await db.paperPosition.findFirst({ where: { accountId: account.id, symbol, side: 'short', status: 'open' } })

  // cierre de posición (sell sobre long / buy sobre short)
  const closing = isLong ? existingShort : existingLong
  if (closing) {
    return closePosition(closing.id, input.source, qty)
  }

  // apertura — el Risk Engine manda
  const stop = input.stopLoss ?? (isLong ? fillPrice * 0.97 : fillPrice * 1.03)
  const take = input.takeProfit ?? (isLong ? fillPrice * 1.06 : fillPrice * 0.94)
  if (!input.skipRiskCheck) {
    const check = await validateEntry({
      symbol,
      side: isLong ? 'long' : 'short',
      entryPrice: fillPrice,
      stopPrice: stop,
      takePrice: take,
      capital: account.cash,
      requestedQty: qty,
    })
    if (!check.approved) {
      const order = await db.paperOrder.create({
        data: {
          accountId: account.id, symbol, side: input.side, type: input.type,
          qty, price: input.type === 'limit' ? input.limitPrice : null,
          status: 'rejected', reason: check.reasons.join(' | '), source: input.source,
        },
      })
      return { ok: false, orderId: order.id, message: `Rechazada por Risk Engine: ${check.reasons[0]}`, details: { reasons: check.reasons } }
    }
    if (check.suggestedQty && check.suggestedQty < qty) {
      qty = check.suggestedQty
      await logRiskEvent('position_size_capped', 'warning', `Tamaño ajustado a ${qty.toPrecision(6)} (${symbol}) por límite de riesgo`, symbol)
    }
  }

  const positionValue = qty * fillPrice
  const commission = positionValue * COMMISSION_RATE

  // validar cash disponible (sin apalancamiento en paper)
  if (positionValue + commission > account.cash) {
    qty = Math.max(0, (account.cash / (1 + COMMISSION_RATE)) / fillPrice)
    if (qty <= 0) return { ok: false, message: 'Efectivo insuficiente para abrir la posición' }
  }

  const finalValue = qty * fillPrice
  const finalCommission = finalValue * COMMISSION_RATE

  const order = await db.paperOrder.create({
    data: {
      accountId: account.id, symbol, side: input.side, type: input.type,
      qty, price: input.type === 'limit' ? input.limitPrice : null,
      status: 'filled', filledPrice: fillPrice, source: input.source,
      filledAt: new Date(),
    },
  })

  const position = await db.paperPosition.create({
    data: {
      accountId: account.id, symbol,
      side: isLong ? 'long' : 'short',
      qty, entryPrice: fillPrice,
      stopLoss: input.stopLoss, takeProfit: input.takeProfit,
      source: input.source,
    },
  })

  await db.paperOrder.update({ where: { id: order.id }, data: { positionId: position.id } })
  await db.paperAccount.update({
    where: { id: account.id },
    data: { cash: { decrement: finalValue + finalCommission } },
  })

  await remember({
    kind: 'episodic',
    key: `${symbol}-posicion-${position.id.slice(-6)}`,
    content: `${isLong ? 'LONG' : 'SHORT'} ${symbol} abierto: ${qty.toPrecision(6)} @ ${fillPrice.toPrecision(6)}, SL ${stop?.toPrecision(6)}, TP ${take?.toPrecision(6)}`,
    importance: 0.6,
    tags: [symbol, 'position'],
  })

  return {
    ok: true, orderId: order.id, positionId: position.id,
    message: `${isLong ? 'LONG' : 'SHORT'} ${symbol} abierto: ${qty.toPrecision(6)} @ ${fillPrice.toPrecision(6)}`,
    details: { fillPrice, qty, commission: finalCommission, stop, take },
  }
}

export async function closePosition(positionId: string, source: PlaceOrderInput['source'], qtyOverride?: number): Promise<PlaceOrderResult> {
  const position = await db.paperPosition.findUnique({ where: { id: positionId }, include: { account: true } })
  if (!position || position.status !== 'open') return { ok: false, message: 'Posición no encontrada o ya cerrada' }

  const price = await getPrice(position.symbol)
  const closeQty = Math.min(qtyOverride ?? position.qty, position.qty)
  const fillPrice = price * (1 + (position.side === 'long' ? -1 : 1) * SLIPPAGE_RATE)

  const sign = position.side === 'long' ? 1 : -1
  const grossPnl = (fillPrice - position.entryPrice) * closeQty * sign
  const commission = closeQty * fillPrice * COMMISSION_RATE
  const netPnl = grossPnl - commission
  const pnlPct = ((fillPrice - position.entryPrice) / position.entryPrice) * 100 * sign

  const order = await db.paperOrder.create({
    data: {
      accountId: position.accountId, symbol: position.symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      type: 'market', qty: closeQty,
      status: 'filled', filledPrice: fillPrice,
      source, realizedPnl: netPnl,
      positionId: position.id, filledAt: new Date(),
    },
  })

  // devuelve cash: costo + PnL
  const cashBack = closeQty * position.entryPrice + netPnl
  await db.paperAccount.update({
    where: { id: position.accountId },
    data: { cash: { increment: Math.max(cashBack, 0) } },
  })

  if (closeQty >= position.qty) {
    await db.paperPosition.update({
      where: { id: position.id },
      data: { status: 'closed', closePrice: fillPrice, realizedPnl: netPnl, closedAt: new Date() },
    })
  } else {
    await db.paperPosition.update({
      where: { id: position.id },
      data: { qty: position.qty - closeQty },
    })
  }

  await learnFromOutcome({
    symbol: position.symbol,
    outcome: netPnl >= 0 ? 'win' : 'loss',
    pnlPct,
    context: `${position.side} cerrado @ ${fillPrice.toPrecision(6)} (entrada ${position.entryPrice.toPrecision(6)})`,
  })

  return {
    ok: true, orderId: order.id,
    message: `${position.symbol} cerrado: PnL ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} USDT (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
    details: { pnl: netPnl, pnlPct, fillPrice },
  }
}

// revisa SL/TP de posiciones abiertas con el precio actual
export async function checkOpenPositions(): Promise<{ triggered: number; details: string[] }> {
  const positions = await db.paperPosition.findMany({ where: { status: 'open' } })
  let triggered = 0
  const details: string[] = []
  for (const p of positions) {
    const price = await getPrice(p.symbol)
    if (!price) continue
    if (p.side === 'long') {
      if (p.stopLoss && price <= p.stopLoss) {
        const r = await closePosition(p.id, 'risk')
        details.push(`SL ${p.symbol}: ${r.message}`); triggered++
      } else if (p.takeProfit && price >= p.takeProfit) {
        const r = await closePosition(p.id, 'risk')
        details.push(`TP ${p.symbol}: ${r.message}`); triggered++
      }
    } else {
      if (p.stopLoss && price >= p.stopLoss) {
        const r = await closePosition(p.id, 'risk')
        details.push(`SL ${p.symbol}: ${r.message}`); triggered++
      } else if (p.takeProfit && price <= p.takeProfit) {
        const r = await closePosition(p.id, 'risk')
        details.push(`TP ${p.symbol}: ${r.message}`); triggered++
      }
    }
  }
  return { triggered, details }
}

export interface PortfolioSummary {
  account: { name: string; baseCurrency: string; startingBalance: number; cash: number }
  equity: number
  positionsValue: number
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
  totalPnlPct: number
  positions: {
    id: string; symbol: string; side: string; qty: number
    entryPrice: number; currentPrice: number
    unrealizedPnl: number; unrealizedPct: number
    stopLoss: number | null; takeProfit: number | null
    openedAt: string
  }[]
  equityCurve: { t: string; equity: number }[]
  stats: { totalClosed: number; wins: number; losses: number; winRate: number; bestPnl: number; worstPnl: number }
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  const account = await ensureAccount()
  const positions = await db.paperPosition.findMany({ where: { status: 'open' }, orderBy: { openedAt: 'desc' } })
  const closedOrders = await db.paperOrder.findMany({ where: { realizedPnl: { not: null } }, orderBy: { filledAt: 'asc' } })

  const enriched = []
  let positionsValue = 0
  let unrealizedPnl = 0
  for (const p of positions) {
    const price = await getPrice(p.symbol)
    const sign = p.side === 'long' ? 1 : -1
    const uPnl = (price - p.entryPrice) * p.qty * sign
    positionsValue += p.qty * p.entryPrice
    unrealizedPnl += uPnl
    enriched.push({
      id: p.id, symbol: p.symbol, side: p.side, qty: p.qty,
      entryPrice: p.entryPrice, currentPrice: price,
      unrealizedPnl: uPnl,
      unrealizedPct: ((price - p.entryPrice) / p.entryPrice) * 100 * sign,
      stopLoss: p.stopLoss, takeProfit: p.takeProfit,
      openedAt: p.openedAt.toISOString(),
    })
  }

  const realizedPnl = closedOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0)
  const equity = account.cash + positionsValue + unrealizedPnl
  const wins = closedOrders.filter((o) => (o.realizedPnl ?? 0) >= 0)
  const losses = closedOrders.filter((o) => (o.realizedPnl ?? 0) < 0)
  const pnls = closedOrders.map((o) => o.realizedPnl ?? 0)

  // curva de equity a partir de los cierres
  let running = account.startingBalance
  const equityCurve = [{ t: new Date().toISOString().slice(0, 10), equity: running }]
  for (const o of closedOrders) {
    running += o.realizedPnl ?? 0
    equityCurve.push({ t: (o.filledAt ?? new Date()).toISOString().slice(0, 16), equity: Math.round(running * 100) / 100 })
  }
  equityCurve.push({ t: new Date().toISOString().slice(0, 16), equity: Math.round(equity * 100) / 100 })

  return {
    account: { name: account.name, baseCurrency: account.baseCurrency, startingBalance: account.startingBalance, cash: Math.round(account.cash * 100) / 100 },
    equity: Math.round(equity * 100) / 100,
    positionsValue: Math.round(positionsValue * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    totalPnl: Math.round((equity - account.startingBalance) * 100) / 100,
    totalPnlPct: ((equity - account.startingBalance) / account.startingBalance) * 100,
    positions: enriched,
    equityCurve,
    stats: {
      totalClosed: closedOrders.length,
      wins: wins.length, losses: losses.length,
      winRate: closedOrders.length ? (wins.length / closedOrders.length) * 100 : 0,
      bestPnl: pnls.length ? Math.max(...pnls) : 0,
      worstPnl: pnls.length ? Math.min(...pnls) : 0,
    },
  }
}

export async function resetAccount(): Promise<void> {
  await db.paperOrder.deleteMany({})
  await db.paperPosition.deleteMany({})
  const account = await db.paperAccount.findFirst()
  if (account) {
    await db.paperAccount.update({
      where: { id: account.id },
      data: { cash: account.startingBalance },
    })
  }
}
