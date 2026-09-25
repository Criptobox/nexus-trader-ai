// ─────────────────────────────────────────────────────────────
// GET /api/opportunities — Radar de Oportunidades de NEXUS
// ?ids=pepe,bonk → monedas custom del usuario a incluir siempre
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { scanOpportunities } from '@/lib/agents/radar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
    const customIds = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => ({ id }))

    const result = await scanOpportunities(customIds)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: 'Error escaneando el mercado', detail: String(e) },
      { status: 500 },
    )
  }
}
