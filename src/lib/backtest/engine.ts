// ─────────────────────────────────────────────────────────────
// Motor de Backtesting — simulación sobre velas históricas
// · Estrategias: SMA Cross, RSI Reversión, Donchian Breakout,
//   Momentum compuesto
// · Comisiones + slippage, curva de equity, drawdown
// · Métricas: CAGR, Sharpe, Sortino, profit factor, win rate
// ─────────────────────────────────────────────────────────────
import type { BacktestMetrics, BacktestTrade, Candle, EquityPoint } from '@/lib/types'
import { sma, rsi, atr } from '@/lib/indicators'
import { getCandles } from '@/lib/market/data'

export interface StrategyParams {
  fast?: number
  slow?: number
  rsiPeriod?: number
  rsiBuy?: number
  rsiSell?: number
  breakoutLookback?: number
  stopAtrMult?: number
  tpAtrMult?: number
}

export interface BacktestConfig {
  symbol: string
  interval: string
  strategy: 'sma_cross' | 'rsi_reversion' | 'breakout' | 'momentum'
  params: StrategyParams
  initialCapital: number
  riskPerTradePct: number
  commissionPct: number
  slippagePct?: number
}


interface OpenTrade {
  side: 'long' | 'short'
  entryIdx: number
  entryPrice: number
  qty: number
  stop: number
  take: number
}

export interface BacktestResult {
  metrics: BacktestMetrics
  equityCurve: EquityPoint[]
  trades: BacktestTrade[]
  config: BacktestConfig
  candlesUsed: number
}

// ── Señales de cada estrategia ───────────────────────────────
function smaCrossSignals(candles: Candle[], p: StrategyParams): ('long' | 'short' | 'exit' | null)[] {
  const closes = candles.map((c) => c.c)
  const fast = sma(closes, p.fast ?? 20)
  const slow = sma(closes, p.slow ?? 50)
  return closes.map((_, i) => {
    if (i === 0 || fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) return null
    const crossUp = (fast[i - 1] as number) <= (slow[i - 1] as number) && (fast[i] as number) > (slow[i] as number)
    const crossDown = (fast[i - 1] as number) >= (slow[i - 1] as number) && (fast[i] as number) < (slow[i] as number)
    return crossUp ? 'long' : crossDown ? 'short' : null
  })
}

function rsiReversionSignals(candles: Candle[], p: StrategyParams): ('long' | 'short' | 'exit' | null)[] {
  const closes = candles.map((c) => c.c)
  const r = rsi(closes, p.rsiPeriod ?? 14)
  return closes.map((_, i) => {
    if (r[i] === null) return null
    const v = r[i] as number
    if (v < (p.rsiBuy ?? 30)) return 'long'
    if (v > (p.rsiSell ?? 70)) return 'short'
    if (v > 50 && v < 55) return 'exit'
    return null
  })
}

function breakoutSignals(candles: Candle[], p: StrategyParams): ('long' | 'short' | 'exit' | null)[] {
  const look = p.breakoutLookback ?? 20
  return candles.map((c, i) => {
    if (i < look) return null
    const window = candles.slice(i - look, i)
    const hh = Math.max(...window.map((w) => w.h))
    const ll = Math.min(...window.map((w) => w.l))
    if (c.c > hh) return 'long'
    if (c.c < ll) return 'short'
    return null
  })
}

function momentumSignals(candles: Candle[], p: StrategyParams): ('long' | 'short' | 'exit' | null)[] {
  const closes = candles.map((c) => c.c)
  const fast = sma(closes, p.fast ?? 20)
  const slow = sma(closes, p.slow ?? 50)
  const r = rsi(closes, p.rsiPeriod ?? 14)
  return closes.map((_, i) => {
    if (fast[i] === null || slow[i] === null || r[i] === null) return null
    const bull = (fast[i] as number) > (slow[i] as number) && (r[i] as number) > 55
    const bear = (fast[i] as number) < (slow[i] as number) && (r[i] as number) < 45
    if (bull) return 'long'
    if (bear) return 'short'
    return null
  })
}

function signalsFor(config: BacktestConfig, candles: Candle[]) {
  switch (config.strategy) {
    case 'sma_cross': return smaCrossSignals(candles, config.params)
    case 'rsi_reversion': return rsiReversionSignals(candles, config.params)
    case 'breakout': return breakoutSignals(candles, config.params)
    case 'momentum': return momentumSignals(candles, config.params)
  }
}

// ── Ejecución del backtest ───────────────────────────────────
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const { candles } = await getCandles(config.symbol, config.interval, 500)
  const signals = signalsFor(config, candles)
  const atrs = atr(candles, 14)
  const stopMult = config.params.stopAtrMult ?? 2
  const tpMult = config.params.tpAtrMult ?? 3

  let cash = config.initialCapital
  let equity = cash
  let open: OpenTrade | null = null
  const trades: BacktestTrade[] = []
  const equityCurve: EquityPoint[] = []
  const riskPerTrade = (config.riskPerTradePct ?? 1) / 100
  const commission = Math.max(0, config.commissionPct ?? 0.1) / 100
  const slippage = Math.max(0, config.slippagePct ?? 0.05) / 100

  const buyHold = candles[0].c

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const price = c.c

    // gestión de posición abierta (stop/take intravela)
    if (open) {
      const hitStop = open.side === 'long' ? c.l <= open.stop : c.h >= open.stop
      const hitTake = open.side === 'long' ? c.h >= open.take : c.l <= open.take
      let exitPrice: number | null = null
      let reason = ''
      if (hitStop && hitTake) {
        exitPrice = open.stop // conservador: asume stop primero
        reason = 'stop'
      } else if (hitStop) { exitPrice = open.stop; reason = 'stop' }
      else if (hitTake) { exitPrice = open.take; reason = 'take' }
      else if (signals[i] === 'exit' || (signals[i] && signals[i] !== open.side)) {
        exitPrice = price; reason = 'señal inversa'
      }
      if (exitPrice !== null) {
        const sign = open.side === 'long' ? 1 : -1
        const gross = (exitPrice - open.entryPrice) * open.qty * sign
        const fees = (open.entryPrice + exitPrice) * open.qty * (commission + slippage)
        const net = gross - fees
        cash += open.qty * open.entryPrice + net
        trades.push({
          entryTime: candles[open.entryIdx].t,
          exitTime: c.t,
          side: open.side,
          entryPrice: open.entryPrice,
          exitPrice,
          qty: open.qty,
          pnl: net,
          pnlPct: ((exitPrice - open.entryPrice) / open.entryPrice) * 100 * sign,
          reason,
        })
        open = null
      }
    }

    // apertura de nueva posición
    if (!open && signals[i] === 'long') {
      const a = atrs[i]
      const stopDist = a !== null ? a * stopMult : price * 0.03
      const riskUsd = equity * riskPerTrade
      const qty = riskUsd / stopDist
      const positionValue = qty * price
      if (positionValue <= cash * 0.98 && qty > 0) {
        const entryPrice = price * (1 + slippage)
        cash -= qty * entryPrice // reserva los fondos al abrir
        open = {
          side: 'long', entryIdx: i, entryPrice, qty,
          stop: price - stopDist,
          take: price + stopDist * tpMult,
        }
      }
    } else if (!open && signals[i] === 'short') {
      const a = atrs[i]
      const stopDist = a !== null ? a * stopMult : price * 0.03
      const riskUsd = equity * riskPerTrade
      const qty = riskUsd / stopDist
      const positionValue = qty * price
      if (positionValue <= cash * 0.98 && qty > 0) {
        const entryPrice = price * (1 - slippage)
        cash -= qty * entryPrice // reserva los fondos al abrir
        open = {
          side: 'short', entryIdx: i, entryPrice, qty,
          stop: price + stopDist,
          take: price - stopDist * tpMult,
        }
      }
    }

    // equity mark-to-market
    let unrealized = 0
    if (open) {
      const sign = open.side === 'long' ? 1 : -1
      unrealized = (price - open.entryPrice) * open.qty * sign
    }
    equity = cash + (open ? open.qty * open.entryPrice + unrealized : 0)
    const peak = equityCurve.length ? Math.max(...equityCurve.map((e) => e.equity), equity) : equity
    equityCurve.push({
      t: c.t,
      equity: Math.round(equity * 100) / 100,
      drawdownPct: peak > 0 ? Math.max(0, ((peak - equity) / peak) * 100) : 0,
    })
  }

  // cierra posición restante al final
  if (open) {
    const last = candles[candles.length - 1].c
    const sign = open.side === 'long' ? 1 : -1
    const gross = (last - open.entryPrice) * open.qty * sign
    const fees = (open.entryPrice + last) * open.qty * (commission + slippage)
    const net = gross - fees
    cash += open.qty * open.entryPrice + net
    trades.push({
      entryTime: candles[open.entryIdx].t, exitTime: candles[candles.length - 1].t,
      side: open.side, entryPrice: open.entryPrice, exitPrice: last,
      qty: open.qty, pnl: net,
      pnlPct: ((last - open.entryPrice) / open.entryPrice) * 100 * sign,
      reason: 'fin del backtest',
    })
    equity = cash
  }

  return { metrics: computeMetrics(config, trades, equityCurve, equity, buyHold), equityCurve, trades, config, candlesUsed: candles.length }
}

function computeMetrics(config: BacktestConfig, trades: BacktestTrade[], equityCurve: EquityPoint[], finalEquity: number, buyHoldPrice: number): BacktestMetrics {
  const returns = equityCurve.map((e, i) => (i === 0 ? 0 : (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity))
  const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length
  const sd = Math.sqrt(returns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / returns.length)
  const downside = returns.filter((r) => r < 0)
  const sdDown = Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / Math.max(downside.length, 1))

  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl <= 0)
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))

  const maxDD = Math.max(...equityCurve.map((e) => e.drawdownPct), 0)
  const totalReturnPct = ((finalEquity - config.initialCapital) / config.initialCapital) * 100
  const candlesPerYear = config.interval === '15m' ? 35040 : config.interval === '1h' ? 8760 : config.interval === '4h' ? 2190 : 365
  const years = equityCurve.length / candlesPerYear
  const cagr = years > 0.02 ? (Math.pow(finalEquity / config.initialCapital, 1 / Math.max(years, 0.02)) - 1) * 100 : totalReturnPct
  const exposurePct = (trades.reduce((s, t) => s + (t.exitTime - t.entryTime), 0) / Math.max(1, equityCurve.length * candlesToMs(config.interval))) * 100

  return {
    finalEquity: Math.round(finalEquity * 100) / 100,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    cagr: Math.round(cagr * 100) / 100,
    sharpe: sd > 0 ? Math.round((meanRet / sd) * Math.sqrt(Math.min(candlesPerYear, 8760)) * 100) / 100 : 0,
    sortino: sdDown > 0 ? Math.round((meanRet / sdDown) * Math.sqrt(Math.min(candlesPerYear, 8760)) * 100) / 100 : 0,
    maxDrawdownPct: Math.round(maxDD * 100) / 100,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 10000) / 100 : 0,
    profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 99 : 0,
    totalTrades: trades.length,
    avgTradePct: trades.length ? Math.round((trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length) * 100) / 100 : 0,
    bestTradePct: trades.length ? Math.max(...trades.map((t) => t.pnlPct)) : 0,
    worstTradePct: trades.length ? Math.min(...trades.map((t) => t.pnlPct)) : 0,
    exposurePct: Math.round(Math.min(exposurePct, 100) * 10) / 10,
  }
}

function candlesToMs(interval: string): number {
  return { '15m': 9e5, '1h': 3.6e6, '4h': 1.44e7, '1d': 8.64e7 }[interval] ?? 3.6e6
}

export const STRATEGY_INFO = {
  sma_cross: { name: 'Cruce SMA', desc: 'Compra cuando SMA rápida cruza al alza la lenta; vende en el cruce bajista. Seguidor de tendencia clásico.' },
  rsi_reversion: { name: 'RSI Reversión', desc: 'Compra en sobreventa (<30) y vende en sobrecompra (>70). Reversión a la media.' },
  breakout: { name: 'Ruptura Donchian', desc: 'Compra rupturas de máximos de N velas; vende rupturas de mínimos. Momentum puro.' },
  momentum: { name: 'Momentum Compuesto', desc: 'Exige confluencia: SMA20>SMA50 y RSI>55 (o lo inverso). Menos operaciones, más filtro.' },
}
