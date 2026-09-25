import { NextRequest, NextResponse } from 'next/server'
import { getRiskConfig, saveRiskConfig, dailyPnlPct, currentDrawdownPct, portfolioExposure } from '@/lib/risk/risk-engine'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getRiskConfig()
    const events = await db.riskEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 40 })
    const account = await db.paperAccount.findFirst()
    const exposure = account ? await portfolioExposure(account.id) : 0
    return NextResponse.json({
      config,
      exposure,
      dailyPnlPct: await dailyPnlPct(),
      drawdownPct: await currentDrawdownPct(),
      openPositions: await db.paperPosition.count({ where: { status: 'open' } }),
      events: events.map((e) => ({ ...e, meta: e.meta ? JSON.parse(e.meta) : null })),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, number | boolean>
    const allowed: (keyof typeof body)[] = [
      'maxRiskPerTrade', 'maxDailyLoss', 'maxDrawdown', 'maxOpenPositions',
      'maxPortfolioExposure', 'maxLeverage', 'atrStopMultiplier', 'minRewardRisk',
      'consecutiveLossLimit', 'volatilityGuard',
    ]
    const patch: Record<string, number | boolean> = {}
    for (const k of allowed) if (k in body) patch[k] = body[k]
    const config = await saveRiskConfig(patch)
    await db.riskEvent.create({
      data: { type: 'config_updated', severity: 'info', message: `Configuración de riesgo actualizada: ${Object.keys(patch).join(', ')}` },
    })
    return NextResponse.json({ config })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
