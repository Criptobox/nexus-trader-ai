// ─────────────────────────────────────────────────────────────
// Risk Engine — valida cada operación ANTES de ejecutarse
// · Riesgo por operación (% capital)
// · Exposición total del portafolio
// · Nº máximo de posiciones abiertas
// · Ratio R:R mínimo
// · Stop diario y drawdown (coordinado con Kill Switch)
// · Guardia de volatilidad (ATR% anómalo)
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import type { RiskCheckResult } from '@/lib/types'
import { atr } from '@/lib/indicators'
import { getCandles } from '@/lib/market/data'

export interface RiskConfigValues {
  maxRiskPerTrade: number
  maxDailyLoss: number
  maxDrawdown: number
  maxOpenPositions: number
  maxPortfolioExposure: number
  maxLeverage: number
  atrStopMultiplier: number
  minRewardRisk: number
  consecutiveLossLimit: number
  volatilityGuard: boolean
}

export async function getRiskConfig(): Promise<RiskConfigValues> {
  let row = await db.riskConfig.findFirst()
  if (!row) row = await db.riskConfig.create({ data: {} })
  return {
    maxRiskPerTrade: row.maxRiskPerTrade,
    maxDailyLoss: row.maxDailyLoss,
    maxDrawdown: row.maxDrawdown,
    maxOpenPositions: row.maxOpenPositions,
    maxPortfolioExposure: row.maxPortfolioExposure,
    maxLeverage: row.maxLeverage,
    atrStopMultiplier: row.atrStopMultiplier,
    minRewardRisk: row.minRewardRisk,
    consecutiveLossLimit: row.consecutiveLossLimit,
    volatilityGuard: row.volatilityGuard,
  }
}

export async function saveRiskConfig(values: Partial<RiskConfigValues>): Promise<RiskConfigValues> {
  const current = await getRiskConfig()
  const merged = { ...current, ...values }
  await db.riskConfig.deleteMany({})
  await db.riskConfig.create({ data: merged })
  return merged
}

export async function logRiskEvent(type: string, severity: 'info' | 'warning' | 'critical', message: string, symbol?: string, meta?: Record<string, unknown>) {
  await db.riskEvent.create({
    data: { type, severity, message, symbol, meta: meta ? JSON.stringify(meta) : undefined },
  })
}

// Valor total de mercado de las posiciones abiertas
export async function portfolioExposure(accountId: string): Promise<number> {
  const positions = await db.paperPosition.findMany({ where: { accountId, status: 'open' } })
  const positionsValue = positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0)
  const account = await db.paperAccount.findUnique({ where: { id: accountId } })
  return account ? (positionsValue / Math.max(account.startingBalance, 1)) * 100 : 0
}

// PnL realizado hoy (% sobre capital inicial)
export async function dailyPnlPct(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const orders = await db.paperOrder.findMany({
    where: { filledAt: { gte: startOfDay }, realizedPnl: { not: null } },
  })
  const pnl = orders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0)
  const account = await db.paperAccount.findFirst()
  return account ? (pnl / Math.max(account.startingBalance, 1)) * 100 : 0
}

// Drawdown actual de la curva de equity (simplificado: capital + posiciones)
export async function currentDrawdownPct(): Promise<number> {
  const account = await db.paperAccount.findFirst()
  if (!account) return 0
  const positions = await db.paperPosition.findMany({ where: { accountId: account.id, status: 'open' } })
  const unrealized = positions.reduce((s, p) => {
    const sign = p.side === 'long' ? 1 : -1
    const price = p.closePrice ?? p.entryPrice
    return s + (price - p.entryPrice) * p.qty * sign
  }, 0)
  const equity = account.cash + positions.reduce((s, p) => s + p.qty * p.entryPrice, 0) + unrealized
  const peak = Math.max(account.startingBalance, equity)
  return peak > 0 ? Math.max(0, ((peak - equity) / peak) * 100) : 0
}

export interface ValidateEntryInput {
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  stopPrice: number
  takePrice?: number
  capital: number
  requestedQty?: number
}

export async function validateEntry(input: ValidateEntryInput): Promise<RiskCheckResult> {
  const cfg = await getRiskConfig()
  const reasons: string[] = []
  const account = await db.paperAccount.findFirst()

  // 1. Kill Switch
  const ks = await db.killSwitchState.findFirst()
  if (ks?.active) {
    reasons.push(`🚨 Kill Switch ACTIVO (${ks.level}): ${ks.reason ?? 'activación manual'}. Toda operativa está bloqueada.`)
    return { approved: false, reasons }
  }

  // 2. Stop diario
  const dayPnl = await dailyPnlPct()
  if (dayPnl <= -cfg.maxDailyLoss) {
    reasons.push(`Stop diario alcanzado (${dayPnl.toFixed(2)}% ≤ −${cfg.maxDailyLoss}%). No se abren posiciones nuevas hoy.`)
    await logRiskEvent('daily_loss_stop', 'critical', `Pérdida diaria ${dayPnl.toFixed(2)}% superó el límite de ${cfg.maxDailyLoss}%`, input.symbol)
    return { approved: false, reasons }
  }

  // 3. Límite de posiciones abiertas
  const openCount = await db.paperPosition.count({ where: { status: 'open' } })
  if (openCount >= cfg.maxOpenPositions) {
    reasons.push(`Máximo de ${cfg.maxOpenPositions} posiciones abiertas alcanzado (tienes ${openCount}).`)
  }

  // 4. Exposición de portafolio
  const exposure = account ? await portfolioExposure(account.id) : 0
  const riskAmount = input.capital * (cfg.maxRiskPerTrade / 100)
  const stopDistancePct = Math.abs(input.entryPrice - input.stopPrice) / input.entryPrice * 100
  if (stopDistancePct <= 0.01) {
    reasons.push('Stop inválido: distancia 0. Define un stop real antes de operar.')
  }
  const suggestedQty = stopDistancePct > 0 ? riskAmount / (input.entryPrice * (stopDistancePct / 100)) : 0
  const positionValue = suggestedQty * input.entryPrice
  const exposureAfter = exposure + (input.capital > 0 ? (positionValue / input.capital) * 100 : 0)
  if (exposureAfter > cfg.maxPortfolioExposure) {
    reasons.push(`Exposición tras la entrada (${exposureAfter.toFixed(1)}%) superaría el máximo (${cfg.maxPortfolioExposure}%). Reduce el tamaño.`)
  }

  // 5. R:R mínimo
  if (input.takePrice) {
    const risk = Math.abs(input.entryPrice - input.stopPrice)
    const reward = Math.abs(input.takePrice - input.entryPrice)
    const rr = risk > 0 ? reward / risk : 0
    if (rr < cfg.minRewardRisk) {
      reasons.push(`R:R ${rr.toFixed(2)} menor que el mínimo exigido (${cfg.minRewardRisk}). Ajusta stop u objetivo.`)
    }
  }

  // 6. Guardia de volatilidad (ATR% en 1h)
  if (cfg.volatilityGuard) {
    const { candles } = await getCandles(input.symbol, '1h', 60)
    const atrs = atr(candles, 14).filter((v): v is number => v !== null)
    const atrPct = atrs.length ? (atrs[atrs.length - 1] / input.entryPrice) * 100 : 0
    if (atrPct > 6) {
      reasons.push(`Volatilidad extrema: ATR ${atrPct.toFixed(1)}% por vela. Guardia de volatilidad activa — esperar calma.`)
    }
  }

  // 7. Riesgo por operación: si el tamaño pedido excede el máximo permitido,
  //    NO se rechaza — placeOrder recorta qty a suggestedQty automáticamente.

  const approved = reasons.length === 0
  if (!approved) {
    const severity = reasons.some((r) => r.includes('Kill Switch') || r.includes('Stop diario')) ? 'critical' : 'warning'
    await logRiskEvent('entry_rejected', severity, reasons.join(' | '), input.symbol, { entryPrice: input.entryPrice })
  } else {
    await logRiskEvent('entry_approved', 'info', `Entrada ${input.side} ${input.symbol} aprobada: qty ${suggestedQty.toPrecision(6)}, stop ${stopDistancePct.toFixed(2)}%`, input.symbol)
  }

  return {
    approved,
    reasons,
    suggestedQty: Math.max(0, suggestedQty),
    suggestedStop: input.stopPrice,
    suggestedTake: input.takePrice ?? input.entryPrice * (input.side === 'long' ? 1 + (stopDistancePct / 100) * 2 : 1 - (stopDistancePct / 100) * 2),
    riskUsd: riskAmount,
    exposureAfter,
  }
}

export const riskEngine = { validateEntry, getRiskConfig, saveRiskConfig, logRiskEvent, dailyPnlPct, currentDrawdownPct, portfolioExposure }
