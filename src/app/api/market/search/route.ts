import { NextRequest, NextResponse } from 'next/server'
import { searchCoins } from '@/lib/market/custom'

export const dynamic = 'force-dynamic'

// GET /api/market/search?q=pepe → resultados con logo original
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  try {
    const results = await searchCoins(q)
    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json(
      { results: [], error: err instanceof Error ? err.message : 'Error de búsqueda' },
      { status: 200 },
    )
  }
}
