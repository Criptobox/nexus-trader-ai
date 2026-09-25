// ─────────────────────────────────────────────────────────────
// Indicadores técnicos puros (sin dependencias)
// ─────────────────────────────────────────────────────────────
import type { Candle } from '@/lib/types'

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    if (prev === null) {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += values[j]
      prev = sum / period
    } else {
      prev = values[i] * k + prev * (1 - k)
    }
    out.push(prev)
  }
  return out
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null]
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const gain = Math.max(diff, 0)
    const loss = Math.max(-diff, 0)
    if (i <= period) {
      avgGain += gain / period
      avgLoss += loss / period
      out.push(i === period ? computeRsi(avgGain, avgLoss) : null)
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      out.push(computeRsi(avgGain, avgLoss))
    }
  }
  return out
}

function computeRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast)
  const emaSlow = ema(values, slow)
  const macdLine = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  )
  const compact = macdLine.filter((v): v is number => v !== null)
  const signalCompact = ema(compact, signal)
  const offset = macdLine.findIndex((v) => v !== null)
  const signalLine = macdLine.map((_, i) => (i >= offset && signalCompact[i - offset] !== undefined ? signalCompact[i - offset] : null))
  const histogram = macdLine.map((v, i) =>
    v !== null && signalLine[i] !== null ? v - (signalLine[i] as number) : null
  )
  return { macdLine, signalLine, histogram }
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const trs: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { trs.push(candles[i].h - candles[i].l); continue }
    const prevClose = candles[i - 1].c
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - prevClose),
      Math.abs(candles[i].l - prevClose),
    ))
  }
  return ema(trs, period)
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    if (mid[i] === null) { upper.push(null); lower.push(null); continue }
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - (mid[i] as number)) ** 2
    const sd = Math.sqrt(variance / period)
    upper.push((mid[i] as number) + mult * sd)
    lower.push((mid[i] as number) - mult * sd)
  }
  return { mid, upper, lower }
}

export interface TechnicalSnapshot {
  price: number
  sma20: number | null
  sma50: number | null
  sma200: number | null
  ema9: number | null
  rsi14: number | null
  macdHist: number | null
  atr14: number | null
  atrPct: number | null
  bbPosition: number | null // 0 = banda inferior, 1 = superior
  trend: 'up' | 'down' | 'side'
  momentumScore: number // -100..100
  support: number
  resistance: number
  volumeTrend: 'rising' | 'falling' | 'flat'
}

export function analyzeTechnicals(candles: Candle[]): TechnicalSnapshot {
  const closes = candles.map((c) => c.c)
  const volumes = candles.map((c) => c.v)
  const price = closes[closes.length - 1]

  const s20 = sma(closes, 20)
  const s50 = sma(closes, 50)
  const s200 = sma(closes, 200)
  const e9 = ema(closes, 9)
  const r14 = rsi(closes, 14)
  const a14 = atr(candles, 14)
  const bb = bollinger(closes, 20, 2)
  const m = macd(closes)

  const last = <T,>(arr: T[]): T | null => (arr.length ? arr[arr.length - 1] : null)
  const sma20 = last(s20), sma50 = last(s50), sma200 = last(s200)
  const rsi14 = last(r14), macdHist = last(m.histogram), atr14 = last(a14)

  let trend: 'up' | 'down' | 'side' = 'side'
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50 && price > sma20) trend = 'up'
    else if (sma20 < sma50 && price < sma20) trend = 'down'
  }

  // score de momentum compuesto
  let score = 0
  if (rsi14 !== null) score += ((rsi14 - 50) / 50) * 30
  if (macdHist !== null) score += Math.sign(macdHist) * Math.min(Math.abs(macdHist) / (price * 0.002 || 1), 1) * 25
  if (sma20 !== null) score += price > sma20 ? 15 : -15
  if (sma50 !== null) score += price > sma50 ? 15 : -15
  if (sma200 !== null) score += price > sma200 ? 15 : -15
  score = Math.max(-100, Math.min(100, score))

  const lookback = candles.slice(-90)
  const support = Math.min(...lookback.map((c) => c.l))
  const resistance = Math.max(...lookback.map((c) => c.h))

  const bbPos = bb.upper[bb.upper.length - 1] !== null && bb.lower[bb.lower.length - 1] !== null && bb.upper[bb.upper.length - 1] !== bb.lower[bb.upper.length - 1]
    ? (price - (bb.lower[bb.lower.length - 1] as number)) / ((bb.upper[bb.upper.length - 1] as number) - (bb.lower[bb.lower.length - 1] as number))
    : null

  const vAvg = volumes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, volumes.length)
  const vPrev = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(10, volumes.length - 10))
  const volumeTrend = vAvg > vPrev * 1.1 ? 'rising' : vAvg < vPrev * 0.9 ? 'falling' : 'flat'

  return {
    price,
    sma20, sma50, sma200,
    ema9: last(e9),
    rsi14, macdHist, atr14,
    atrPct: atr14 !== null ? (atr14 / price) * 100 : null,
    bbPosition: bbPos,
    trend,
    momentumScore: Math.round(score),
    support, resistance,
    volumeTrend,
  }
}
