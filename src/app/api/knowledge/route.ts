import { NextRequest, NextResponse } from 'next/server'
import { searchKB, KB_GLOSSARY, KB_ARTICLES } from '@/lib/knowledge/kb'
import { listMemories, forget, remember } from '@/lib/memory/agent-memory'

export const dynamic = 'force-dynamic'

// GET /api/knowledge?q=velas  |  GET /api/knowledge?memories=1
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('memories')) {
      const kind = searchParams.get('kind') as never
      return NextResponse.json({ memories: await listMemories(kind) })
    }
    const q = searchParams.get('q')
    return NextResponse.json({
      articles: q !== null ? searchKB(q ?? '') : KB_ARTICLES,
      glossary: KB_GLOSSARY,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: 'remember' | 'forget'; id?: string; kind?: string; key?: string; content?: string; importance?: number }
    if (body.action === 'forget' && body.id) {
      await forget(body.id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'remember' && body.key && body.content) {
      await remember({
        kind: (body.kind as never) ?? 'semantic',
        key: body.key, content: body.content,
        importance: body.importance ?? 0.5,
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, message: 'Acción inválida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
