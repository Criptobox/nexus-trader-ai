import { NextRequest, NextResponse } from 'next/server'
import { getQuotes, getCandles, generateSyntheticCandles } from '@/lib/market/data'
import { getCustomQuotes, getCustomCandles } from '@/lib/market/custom'
import { analyzeTechnicals } from '@/lib/indicators'

export const dynamic = 'force-dynamic'

// GET /api/market                    → cotizaciones de las 20 monedas base
// GET /api/market?ids=pepe,solana    → cotizaciones de monedas custom (CoinGecko)
// GET /api/market?symbol=BTC         → detalle con snapshot técnico
// GET /api/market?symbol=BTC&candles=1h&limit=200 → velas
// GET /api/market?symbol=PEPE&candles=1h&cg=pepe → velas de moneda custom
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')
    const ids = searchParams.get('ids')
    const cgId = searchParams.get('cg')
    const interval = searchParams.get('candles') ?? searchParams.get('interval')
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)

    // monedas personalizadas → cotizaciones con logo original
    if (ids) {
      const coins = ids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)
      const customQuotes = await getCustomQuotes(coins.map((id) => ({ id })))
      return NextResponse.json({ customQuotes, source: customQuotes.length ? 'coingecko' : 'demo' })
    }

    if (symbol && interval) {
      // con cgId: Binance primero (si el par existe) → CoinGecko → demo
      const { candles, source } = await getCandles(symbol, interval, limit, cgId)
      const snap = analyzeTechnicals(candles)
      return NextResponse.json({ symbol, cgId, interval, candles, source, technical: snap })
    }

    if (symbol && cgId) {
      const [customQuotes, custom] = await Promise.all([
        getCustomQuotes([{ id: cgId }]),
        getCustomCandles(cgId, '1h', 150),
      ])
      const candles = custom && custom.length > 10 ? custom : generateSyntheticCandles(symbol, '1h', 150)
      return NextResponse.json({
        quote: customQuotes[0] ?? null,
        technical: analyzeTechnicals(candles),
        source: custom?.length ? 'coingecko' : 'demo',
      })
    }

    if (symbol) {
      const [{ quotes }, { candles, source }] = await Promise.all([
        getQuotes(),
        getCandles(symbol, '1h', 150),
      ])
      const quote = quotes.find((q) => q.symbol === symbol.toUpperCase())
      return NextResponse.json({ quote, technical: analyzeTechnicals(candles), source })
    }

    const { quotes, source } = await getQuotes()
    return NextResponse.json({ quotes, source })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error de mercado' }, { status: 500 })
  }
}
