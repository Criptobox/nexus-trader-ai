import { NextRequest, NextResponse } from 'next/server'
import { getPortfolio, placeOrder, closePosition, resetAccount, ensureAccount, checkOpenPositions } from '@/lib/trading/paper-engine'
import { evaluateTriggers } from '@/lib/risk/kill-switch'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureAccount()
    // revisa SL/TP y dispara el kill switch si corresponde
    await checkOpenPositions()
    await evaluateTriggers()
    const portfolio = await getPortfolio()
    return NextResponse.json(portfolio)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error del portafolio' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: 'order' | 'close' | 'reset'
      symbol?: string
      side?: 'buy' | 'sell'
      type?: 'market' | 'limit'
      qty?: number
      usdAmount?: number
      limitPrice?: number
      stopLoss?: number
      takeProfit?: number
      positionId?: string
      source?: 'manual' | 'agent'
    }

    if (body.action === 'order') {
      if (!body.symbol || !body.side) return NextResponse.json({ ok: false, message: 'symbol y side requeridos' }, { status: 400 })
      const result = await placeOrder({
        symbol: body.symbol,
        side: body.side,
        type: body.type ?? 'market',
        qty: body.qty,
        usdAmount: body.usdAmount,
        limitPrice: body.limitPrice,
        stopLoss: body.stopLoss,
        takeProfit: body.takeProfit,
        source: body.source ?? 'manual',
      })
      await evaluateTriggers()
      return NextResponse.json(result, { status: result.ok ? 200 : 422 })
    }

    if (body.action === 'close') {
      if (!body.positionId) return NextResponse.json({ ok: false, message: 'positionId requerido' }, { status: 400 })
      const result = await closePosition(body.positionId, 'manual')
      await evaluateTriggers()
      return NextResponse.json(result)
    }

    if (body.action === 'reset') {
      await resetAccount()
      return NextResponse.json({ ok: true, message: 'Cuenta paper reiniciada' })
    }

    return NextResponse.json({ ok: false, message: 'Acción inválida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
