import { NextRequest, NextResponse } from 'next/server'
import { runBacktest, STRATEGY_INFO, type BacktestConfig } from '@/lib/backtest/engine'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<BacktestConfig> & { name?: string }
    const config: BacktestConfig = {
      symbol: (body.symbol ?? 'BTC').toUpperCase(),
      interval: body.interval ?? '1h',
      strategy: body.strategy ?? 'sma_cross',
      params: body.params ?? {},
      initialCapital: Math.max(100, Number(body.initialCapital ?? 10000)),
      riskPerTradePct: Math.min(5, Math.max(0.1, Number(body.riskPerTradePct ?? 1))),
      commissionPct: Math.min(2, Math.max(0, Number(body.commissionPct ?? 0.1))),
      slippagePct: Math.min(2, Math.max(0, Number(body.slippagePct ?? 0.05))),
    }

    const result = await runBacktest(config)

    await db.backtestRun.create({
      data: {
        name: body.name ?? `${STRATEGY_INFO[config.strategy].name} ${config.symbol} ${config.interval}`,
        symbol: config.symbol,
        interval: config.interval,
        strategy: config.strategy,
        params: JSON.stringify(config.params),
        initialCapital: config.initialCapital,
        metrics: JSON.stringify(result.metrics),
        equityCurve: JSON.stringify(result.equityCurve.filter((_, i) => i % 2 === 0)), // muestreada
        trades: JSON.stringify(result.trades.slice(-100)),
      },
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error del backtest' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const runs = await db.backtestRun.findMany({ orderBy: { createdAt: 'desc' }, take: 15 })
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id, name: r.name, symbol: r.symbol, interval: r.interval,
        strategy: r.strategy, initialCapital: r.initialCapital,
        metrics: JSON.parse(r.metrics || '{}'), createdAt: r.createdAt.toISOString(),
      })),
      strategies: STRATEGY_INFO,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
