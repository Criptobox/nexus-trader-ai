// ─────────────────────────────────────────────────────────────
// Adaptador de exchange — capa de abstracción multi-exchange
// Fase actual: SOLO LECTURA (klines, tickers, balance de cuenta
// si hay claves). La ejecución real se habilita en el Roadmap
// Fase 4 (ver docs/ROADMAP.md) — por diseño, no por límite técnico.
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto'
import { getKeySecret } from '@/lib/security/vault'
import { getCandles, getQuotes } from '@/lib/market/data'
import type { Candle, Quote } from '@/lib/types'

export interface ExchangeAdapter {
  id: string
  name: string
  connected: boolean
  scope: 'read' | 'trade'
  getKlines(symbol: string, interval: string, limit: number): Promise<Candle[]>
  getQuotes(): Promise<Quote[]>
  getAccountBalance?(): Promise<{ asset: string; free: number; locked: number }[]>
}

export interface ExchangeStatus {
  exchanges: {
    id: string
    name: string
    supported: boolean
    connected: boolean
    keysConfigured: number
    scope: string
    tradingEnabled: boolean
    note: string
  }[]
  executionMode: 'paper_only'
  roadmapPhase: string
}

const SUPPORTED: { id: string; name: string; note: string }[] = [
  { id: 'binance', name: 'Binance', note: 'Datos públicos en vivo; ejecución real deshabilitada (Fase 4 del roadmap)' },
  { id: 'bybit', name: 'Bybit', note: 'Preparado en la arquitectura — implementar adaptador REST en Fase 4' },
  { id: 'okx', name: 'OKX', note: 'Preparado en la arquitectura — implementar adaptador REST en Fase 4' },
  { id: 'coinbase', name: 'Coinbase', note: 'Preparado en la arquitectura — implementar adaptador REST en Fase 4' },
]

export async function getExchangeStatus(): Promise<ExchangeStatus> {
  const keys = await (await import('@/lib/security/vault')).listKeys()
  const binanceKeys = keys.filter((k) => k.exchange === 'binance' && k.active)
  return {
    exchanges: SUPPORTED.map((e) => ({
      id: e.id,
      name: e.name,
      supported: e.id === 'binance',
      connected: e.id === 'binance',
      keysConfigured: keys.filter((k) => k.exchange === e.id).length,
      scope: binanceKeys.length ? binanceKeys[0].scope : 'read',
      tradingEnabled: false,
      note: e.note,
    })),
    executionMode: 'paper_only',
    roadmapPhase: 'Fase 3 — paper trading validado; ejecución real bloqueada por diseño',
  }
}

// Firma HMAC-SHA256 para endpoints privados de Binance (lectura de cuenta)
export async function signedBinanceRequest(path: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const keyRow = (await import('@/lib/security/vault')).listKeys().then((keys) => keys.find((k) => k.exchange === 'binance' && k.active))
  if (!keyRow) return null
  const apiKey = keyRow.masked // nunca usamos la máscara: pedimos el secreto real
  const secret = await getKeySecret(keyRow.id)
  if (!secret) return null

  const query = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: '5000' })
  const signature = crypto.createHmac('sha256', secret).update(query.toString()).digest('hex')
  query.append('signature', signature)

  try {
    const res = await fetch(`https://api.binance.com${path}?${query.toString()}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function getAccountSnapshot(): Promise<{ ok: boolean; balances?: { asset: string; free: number; locked: number }[]; error?: string }> {
  const result = await signedBinanceRequest('/api/v3/account', {})
  if (!result) return { ok: false, error: 'Sin claves activas de Binance o red no disponible. Configura una clave de solo lectura en Ajustes.' }
  const balances = (result.balances as { asset: string; free: string; locked: string }[])
    ?.map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) }))
    ?.filter((b) => b.free + b.locked > 0)
  return { ok: true, balances }
}

export const binanceAdapter: ExchangeAdapter = {
  id: 'binance',
  name: 'Binance',
  connected: true,
  scope: 'read',
  getKlines: (symbol, interval, limit) => getCandles(symbol, interval, limit).then((r) => r.candles),
  getQuotes: () => getQuotes().then((r) => r.quotes),
}
