import { NextRequest, NextResponse } from 'next/server'
import { getStatus, manualActivate, deactivate, evaluateTriggers } from '@/lib/risk/kill-switch'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = await getStatus()
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: 'activate' | 'deactivate' | 'evaluate'; reason?: string }
    if (body.action === 'activate') {
      return NextResponse.json(await manualActivate(body.reason ?? 'Activación manual'))
    }
    if (body.action === 'deactivate') {
      return NextResponse.json(await deactivate())
    }
    return NextResponse.json(await evaluateTriggers())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
