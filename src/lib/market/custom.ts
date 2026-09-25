// ─────────────────────────────────────────────────────────────
// Monedas personalizadas — búsqueda y datos vía CoinGecko API
// pública (sin clave). Permite operar con CUALQUIER moneda de
// las +13.000 listadas: búsqueda por nombre/símbolo, logo
// original oficial, cotización y velas OHLC sintetizadas.
// ─────────────────────────────────────────────────────────────
import type { Candle, Quote } from '@/lib/types'

const CG_BASE = 'https://api.coingecko.com/api/v3'

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

// fetch con timeout, caché, reintentos ante 429 (rate limit) y
// caché "stale" como último recurso; devuelve null si todo falla
const staleCache = new Map<string, unknown>()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function cgFetch<T>(path: string, ttlMs: number): Promise<T | null> {
  const cached = getCache<T>(path)
  if (cached) return cached

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(`${CG_BASE}${path}`, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeout)

      if (res.status === 429) {
        // rate limit → espera creciente con jitter y reintenta (ventana de ~1 min)
        await sleep(1600 * (attempt + 1) + Math.random() * 900)
        continue
      }
      if (!res.ok) break

      const data = (await res.json()) as T
      setCache(path, data, ttlMs)
      staleCache.set(path, data)
      return data
    } catch {
      // timeout/abort → un intento más con paciencia
      await sleep(700 * (attempt + 1))
    }
  }
  // sin red / rate limit persistente → sirve la última copia buena
  return (staleCache.get(path) as T) ?? null
}

// ── Búsqueda de monedas (nombre o símbolo) ───────────────────
export interface CoinSearchResult {
  id: string        // id de CoinGecko (ej. "pepe")
  symbol: string    // PEPE
  name: string      // Pepe
  image: string     // logo original oficial
  rank: number | null
}

interface CGSearchCoin {
  id: string
  symbol: string
  name: string
  thumb: string
  large: string
  market_cap_rank: number | null
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const data = await cgFetch<{ coins: CGSearchCoin[] }>(
    `/search?query=${encodeURIComponent(q)}`,
    30 * 60_000,
  )
  if (!data?.coins?.length) return []
  return data.coins.slice(0, 14).map((c) => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.large || c.thumb,
    rank: c.market_cap_rank,
  }))
}

// ── Proyectos en tendencia (radar de oportunidades) ──────────
interface CGTrending {
  coins: {
    item: {
      id: string
      symbol: string
      name: string
      market_cap_rank: number | null
      thumb: string
      small: string
      large: string
      data: { price_change_percentage_24h: { usd: number } | null }
    }
  }[]
}

export interface TrendingCoin {
  id: string
  symbol: string
  name: string
  rank: number          // posición en la lista de tendencias (1 = más caliente)
  image: string
  marketCapRank: number | null
  change24h: number | null
}

export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const data = await cgFetch<CGTrending>('/search/trending', 10 * 60_000)
  if (!data?.coins?.length) return []
  return data.coins.slice(0, 7).map((c, i) => ({
    id: c.item.id,
    symbol: c.item.symbol.toUpperCase(),
    name: c.item.name,
    rank: i + 1,
    image: c.item.large || c.item.small || c.item.thumb,
    marketCapRank: c.item.market_cap_rank,
    change24h: c.item.data?.price_change_percentage_24h?.usd ?? null,
  }))
}

// ── Cotizaciones para ids de CoinGecko (watchlist custom) ────
interface CGMarketRow {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number | null
  high_24h: number | null
  low_24h: number | null
  total_volume: number | null
  market_cap: number | null
  sparkline_in_7d?: { price: number[] }
}

export async function getCustomQuotes(
  coins: { id: string }[],
  opts: { sparkline?: boolean } = {},
): Promise<Quote[]> {
  if (coins.length === 0) return []
  const withSpark = opts.sparkline ?? true
  const ids = coins.map((c) => c.id).join(',')
  const rows = await cgFetch<CGMarketRow[]>(
    `/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&sparkline=${withSpark}&price_change_percentage=24h`,
    withSpark ? 90_000 : 120_000,
  )
  if (!rows?.length) return []

  const byId = new Map(coins.map((c) => [c.id, c]))
  return rows.map((r) => {
    const sparkFull = r.sparkline_in_7d?.price ?? []
    // comprime 7 días → 24 puntos para el sparkline
    const spark: number[] = []
    if (sparkFull.length > 0) {
      const step = Math.max(1, Math.floor(sparkFull.length / 24))
      for (let i = sparkFull.length - 24 * step; i < sparkFull.length; i += step) {
        if (i >= 0) spark.push(sparkFull[i])
      }
      if (spark.length < 2) spark.push(sparkFull[sparkFull.length - 1])
    }
    return {
      symbol: r.symbol.toUpperCase(),
      name: r.name,
      price: r.current_price ?? 0,
      change24h: r.price_change_percentage_24h ?? 0,
      change7d: r.price_change_percentage_24h ?? 0, // aprox: misma ventana
      high24h: r.high_24h ?? r.current_price ?? 0,
      low24h: r.low_24h ?? r.current_price ?? 0,
      volume24h: r.total_volume ?? 0,
      marketCap: r.market_cap ?? 0,
      spark: spark.length >= 2 ? spark : [r.current_price ?? 0, r.current_price ?? 0],
      source: 'coingecko' as const,
      imageUrl: r.image,
      coingeckoId: byId.get(r.id)?.id ?? r.id,
    }
  })
}

// ── Velas OHLC desde market_chart (granularidad automática) ──
// CoinGecko: days=1 → puntos cada 5 min · days 2-90 → cada 1 h
// · days >90 → daily. Agregamos por bucket del intervalo pedido.
const INTERVAL_DAYS: Record<string, number> = { '15m': 1, '1h': 7, '4h': 30, '1d': 180 }
const INTERVAL_MS: Record<string, number> = {
  '15m': 9e5, '1h': 3.6e6, '4h': 1.44e7, '1d': 8.64e7,
}

export async function getCustomCandles(id: string, interval: string, limit: number): Promise<Candle[] | null> {
  const days = INTERVAL_DAYS[interval] ?? 7
  const bucketMs = INTERVAL_MS[interval] ?? 3.6e6
  const data = await cgFetch<{ prices: [number, number][]; total_volumes: [number, number][] }>(
    `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`,
    10 * 60_000,
  )
  if (!data?.prices?.length) return null

  const volumes = data.total_volumes ?? []
  const volByBucket = new Map<number, number[]>()
  for (const [ts, v] of volumes) {
    const b = Math.floor(ts / bucketMs)
    if (!volByBucket.has(b)) volByBucket.set(b, [])
    volByBucket.get(b)!.push(v)
  }

  // sintetiza OHLC por bucket temporal
  const buckets = new Map<number, { t: number; o: number; h: number; l: number; c: number }[]>()
  for (const [ts, price] of data.prices) {
    const b = Math.floor(ts / bucketMs)
    if (!buckets.has(b)) buckets.set(b, [])
    buckets.get(b)!.push({ t: ts, o: price, h: price, l: price, c: price })
  }

  const candles: Candle[] = []
  for (const [b, pts] of buckets) {
    if (pts.length === 0) continue
    const vols = volByBucket.get(b) ?? []
    const v = vols.length ? vols.reduce((a, x) => a + x, 0) / vols.length : 0
    candles.push({
      t: b * bucketMs,
      o: pts[0].o,
      h: Math.max(...pts.map((p) => p.h)),
      l: Math.min(...pts.map((p) => p.l)),
      c: pts[pts.length - 1].c,
      v,
    })
  }

  candles.sort((a, b) => a.t - b.t)
  return candles.slice(-limit)
}
