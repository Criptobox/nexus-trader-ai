// ─────────────────────────────────────────────────────────────
// Proveedor de datos de mercado: Binance público + fallback
// sintético determinista (modo DEMO sin conexión)
// ─────────────────────────────────────────────────────────────
import type { Candle, Quote } from '@/lib/types'
import { COINS, coinPair } from '@/lib/market/coins'
import { getCustomCandles } from '@/lib/market/custom'

const BINANCE_BASE = 'https://api.binance.com'

interface CacheEntry<T> { data: T; expires: number }
const cache = new Map<string, CacheEntry<unknown>>()

function getCache<T>(key: string): T | null {
  const e = cache.get(key) as CacheEntry<T> | undefined
  if (e && e.expires > Date.now()) return e.data
  cache.delete(key)
  return null
}
function setCache<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs })
}

export function isDemoMode(): boolean {
  return process.env.NEXUS_MARKET_SOURCE === 'demo'
}

// ── Velas reales (Binance) ───────────────────────────────────
async function fetchBinanceKlines(pair: string, interval: string, limit: number): Promise<Candle[] | null> {
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 4500)
    const res = await fetch(
      `${BINANCE_BASE}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { signal: ctrl.signal, cache: 'no-store' },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const raw = (await res.json()) as (string | number)[][]
    return raw.map((k) => ({
      t: Number(k[0]), o: Number(k[1]), h: Number(k[2]),
      l: Number(k[3]), c: Number(k[4]), v: Number(k[5]),
    }))
  } catch {
    return null
  }
}

// ── Generador sintético determinista (random walk con semilla) ─
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_PRICES: Record<string, number> = {
  BTC: 64850, ETH: 3150, SOL: 148, BNB: 585, XRP: 0.62, ADA: 0.45,
  DOGE: 0.135, AVAX: 27.5, LINK: 14.2, DOT: 6.4, MATIC: 0.58, LTC: 72,
  ATOM: 7.1, UNI: 7.8, TON: 5.6, TRX: 0.12, SHIB: 0.000018, ARB: 0.75,
  OP: 1.65, APT: 8.2,
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function generateSyntheticCandles(symbol: string, interval: string, limit: number, endTime = Date.now()): Candle[] {
  const intervalMs: Record<string, number> = {
    '15m': 9e5, '1h': 3.6e6, '4h': 1.44e7, '1d': 8.64e7,
  }
  const step = intervalMs[interval] ?? 3.6e6
  const rnd = mulberry32(hashString(symbol + interval) + Math.floor(endTime / step) * 7)
  const base = BASE_PRICES[symbol.replace('USDT', '')] ?? 100

  // volatilidad por vela según intervalo
  const vol = { '15m': 0.0035, '1h': 0.007, '4h': 0.014, '1d': 0.03 }[interval] ?? 0.007

  const candles: Candle[] = []
  // caminar hacia atrás desde precio base y luego invertir
  let price = base
  const temps: Candle[] = []
  const drift = (rnd() - 0.45) * vol * 0.35 // sesgo leve alcista/bajista
  for (let i = 0; i < limit; i++) {
    const shock = (rnd() - 0.5) * 2 * vol
    const o = price
    const c = Math.max(o * (1 + drift + shock), o * 0.9)
    const wick = Math.abs(shock) * o * (0.5 + rnd())
    const h = Math.max(o, c) + wick * rnd()
    const l = Math.min(o, c) - wick * rnd()
    const v = (0.6 + rnd()) * (base > 1000 ? 900 : base > 10 ? 90000 : 4.5e7)
    temps.push({ t: 0, o, h, l, c, v })
    price = c
  }
  // invertir para que lo más reciente sea el final
  for (let i = temps.length - 1; i >= 0; i--) {
    const candle = temps[i]
    candles.push({ ...candle, t: endTime - (temps.length - i) * step })
  }
  return candles
}

export async function getCandles(
  symbol: string,
  interval = '1h',
  limit = 200,
  cgId?: string,
): Promise<{ candles: Candle[]; source: 'binance' | 'demo' | 'coingecko' }> {
  const key = `k:${symbol}:${interval}:${limit}:${cgId ?? ''}`
  const cached = getCache<{ candles: Candle[]; source: 'binance' | 'demo' | 'coingecko' }>(key)
  if (cached) return cached

  let result: { candles: Candle[]; source: 'binance' | 'demo' | 'coingecko' } | null = null
  if (!isDemoMode()) {
    const klines = await fetchBinanceKlines(coinPair(symbol), interval, limit)
    if (klines && klines.length > 20) result = { candles: klines, source: 'binance' }
  }
  // moneda sin par en Binance → intenta CoinGecko con el id guardado
  if (!result && cgId) {
    const custom = await getCustomCandles(cgId, interval, limit)
    if (custom && custom.length > 20) result = { candles: custom, source: 'coingecko' }
  }
  if (!result) {
    result = { candles: generateSyntheticCandles(symbol, interval, limit), source: 'demo' }
  }
  setCache(key, result, 60_000)
  return result
}

// ── Cotizaciones 24h ─────────────────────────────────────────
async function fetchBinance24h(): Promise<Map<string, { last: number; pct: number; high: number; low: number; vol: number }> | null> {
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 4500)
    const symbols = encodeURIComponent(JSON.stringify(COINS.map((c) => coinPair(c.symbol))))
    const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${symbols}`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timeout)
    if (!res.ok) return null
    const rows = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string }[]
    const map = new Map<string, { last: number; pct: number; high: number; low: number; vol: number }>()
    for (const r of rows) {
      map.set(r.symbol.replace('USDT', ''), {
        last: Number(r.lastPrice), pct: Number(r.priceChangePercent),
        high: Number(r.highPrice), low: Number(r.lowPrice), vol: Number(r.quoteVolume),
      })
    }
    return map
  } catch {
    return null
  }
}

function syntheticQuote(symbol: string): { last: number; pct: number; high: number; low: number; vol: number; spark: number[] } {
  const candles = generateSyntheticCandles(symbol, '1h', 30)
  const last = candles[candles.length - 1].c
  const first = candles[0].o
  const pct = ((last - first) / first) * 100
  const highs = candles.map((c) => c.h)
  const lows = candles.map((c) => c.l)
  const spark = candles.map((c) => c.c)
  const base = BASE_PRICES[symbol] ?? 100
  return {
    last, pct,
    high: Math.max(...highs), low: Math.min(...lows),
    vol: base > 1000 ? 2.1e9 : base > 10 ? 9.5e8 : 6.2e5,
    spark,
  }
}

export async function getQuotes(): Promise<{ quotes: Quote[]; source: 'binance' | 'demo' }> {
  const key = 'q:all'
  const cached = getCache<{ quotes: Quote[]; source: 'binance' | 'demo' }>(key)
  if (cached) return cached

  const live = isDemoMode() ? null : await fetchBinance24h()
  const source: 'binance' | 'demo' = live ? 'binance' : 'demo'
  const seed = hashString(String(Math.floor(Date.now() / 3.6e6))) // cambia cada hora

  const quotes: Quote[] = COINS.map((coin, idx) => {
    if (live && live.has(coin.symbol)) {
      const q = live.get(coin.symbol)!
      // sparkline sintético anclado al precio real (solo visual)
      const rnd = mulberry32(hashString(coin.symbol) + seed)
      const spark = Array.from({ length: 24 }, (_, i) => {
        const wave = Math.sin((i / 24) * Math.PI * (1 + rnd() * 0.5)) * q.pct * 0.4
        return q.last * (1 - (q.pct / 100) + (i / 23) * (q.pct / 100) * 2 + wave / 100)
      })
      return {
        symbol: coin.symbol, price: q.last, change24h: q.pct,
        change7d: Math.round((q.pct * 1.8 + idx * 0.3) * 100) / 100,
        high24h: q.high, low24h: q.low, volume24h: q.vol,
        marketCap: q.last * (coin.symbol === 'BTC' ? 19.8e6 : coin.symbol === 'ETH' ? 120e6 : coin.symbol === 'SHIB' ? 5.9e14 : 1e9),
        spark, source: 'binance' as const,
      }
    }
    const s = syntheticQuote(coin.symbol)
    const rnd = mulberry32(hashString(coin.symbol) + seed)
    return {
      symbol: coin.symbol, price: s.last, change24h: s.pct,
      change7d: Math.round((s.pct * 1.9 + (rnd() - 0.4) * 6) * 100) / 100,
      high24h: s.high, low24h: s.low, volume24h: s.vol,
      marketCap: s.last * (coin.symbol === 'BTC' ? 19.8e6 : coin.symbol === 'ETH' ? 120e6 : 1e9),
      spark: s.spark, source: 'demo' as const,
    }
  })

  const out = { quotes, source }
  setCache(key, out, 30_000)
  return out
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const { quotes } = await getQuotes()
  return quotes.find((q) => q.symbol === symbol.toUpperCase()) ?? null
}

export async function getPrice(symbol: string): Promise<number> {
  const q = await getQuote(symbol)
  return q?.price ?? (BASE_PRICES[symbol.toUpperCase()] ?? 100)
}
