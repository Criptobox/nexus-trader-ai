import { NextRequest, NextResponse } from 'next/server'
import { runAnalysisPipeline } from '@/lib/agents/orchestrator'
import { COINS } from '@/lib/market/coins'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/agent/analyze { symbol, execute?, cgId? } → decisión multiagente
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { symbol?: string; execute?: boolean; cgId?: string }
    const symbol = (body.symbol ?? 'BTC').toUpperCase().slice(0, 12)
    const cgId = body.cgId?.trim() || undefined
    const decision = await runAnalysisPipeline(symbol, cgId)

    // la ejecución paper solo está permitida en las monedas base con par real
    const baseCoin = COINS.some((c) => c.symbol === symbol)
    if (body.execute && !baseCoin) {
      decision.riskNotes.push('Ejecución paper disponible solo para las 20 monedas base — análisis informativo.')
      return NextResponse.json(decision)
    }

    if (body.execute && decision.riskApproved && decision.action !== 'hold') {
      const { placeOrder } = await import('@/lib/trading/paper-engine')
      const result = await placeOrder({
        symbol,
        side: decision.action === 'buy' ? 'buy' : 'sell',
        type: 'market',
        qty: decision.stopLoss && decision.entry
          ? undefined
          : undefined,
        usdAmount: Math.min(decision.positionSizeUsd ?? 500, 2000),
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
        source: 'agent',
      })
      decision.executed = result.ok as never
      decision.riskNotes.push(result.message)
      await db.agentDecision.updateMany({
        where: { symbol, executed: false },
        data: { executed: result.ok },
      })
    }

    return NextResponse.json(decision)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error del análisis' }, { status: 500 })
  }
}

// GET → decisiones recientes
export async function GET() {
  try {
    const decisions = await db.agentDecision.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
    return NextResponse.json({
      decisions: decisions.map((d) => ({
        ...d,
        agents: JSON.parse(d.agents || '[]'),
        riskCheck: d.riskCheck ? JSON.parse(d.riskCheck) : null,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
