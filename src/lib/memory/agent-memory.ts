// ─────────────────────────────────────────────────────────────
// Memoria del agente — capa de persistencia cognitiva
// · Memoria episódica: qué pasó (operaciones, análisis recientes)
// · Memoria semántica: hechos aprendidos sobre el mercado
// · Preferencias del usuario y lecciones aprendidas
// La recuperación prioriza importancia × recencia × coincidencia
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'

export interface MemoryItem {
  id: string
  kind: 'episodic' | 'semantic' | 'preference' | 'lesson'
  key: string
  content: string
  importance: number
  tags: string[]
  hits: number
  createdAt: Date
  lastUsedAt: Date
}

export async function remember(input: {
  kind: MemoryItem['kind']
  key: string
  content: string
  importance?: number
  tags?: string[]
}): Promise<void> {
  // si ya existe la clave, actualiza contenido e importancia (media)
  const existing = await db.agentMemory.findFirst({ where: { key: input.key, kind: input.kind } })
  if (existing) {
    await db.agentMemory.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        importance: Math.min(1, (existing.importance + (input.importance ?? 0.5)) / 2),
        lastUsedAt: new Date(),
      },
    })
  } else {
    await db.agentMemory.create({
      data: {
        kind: input.kind,
        key: input.key,
        content: input.content,
        importance: input.importance ?? 0.5,
        tags: JSON.stringify(input.tags ?? []),
      },
    })
  }
}

export async function recall(options: {
  query?: string
  kinds?: MemoryItem['kind'][]
  limit?: number
}): Promise<MemoryItem[]> {
  const limit = options.limit ?? 8
  const rows = await db.agentMemory.findMany({
    where: options.kinds?.length ? { kind: { in: options.kinds } } : {},
    orderBy: { lastUsedAt: 'desc' },
    take: 200,
  })

  const now = Date.now()
  const scored = rows.map((r) => {
    const ageDays = (now - new Date(r.createdAt).getTime()) / 86_400_000
    const recency = Math.exp(-ageDays / 14) // decae en ~2 semanas
    const q = (options.query ?? '').toLowerCase()
    const matches =
      (q && (r.key.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)) ? 0.6 : 0) +
      r.importance * 0.6 + recency * 0.5
    return { row: r, score: matches }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)

  // registra uso (hits) en paralelo sin bloquear
  void Promise.all(
    top.map((t) =>
      db.agentMemory.update({ where: { id: t.row.id }, data: { hits: { increment: 1 }, lastUsedAt: new Date() } }).catch(() => null),
    ),
  )

  return top.map((t) => ({
    id: t.row.id,
    kind: t.row.kind as MemoryItem['kind'],
    key: t.row.key,
    content: t.row.content,
    importance: t.row.importance,
    tags: JSON.parse(t.row.tags || '[]') as string[],
    hits: t.row.hits,
    createdAt: new Date(t.row.createdAt),
    lastUsedAt: new Date(t.row.lastUsedAt),
  }))
}

export async function buildMemoryContext(query: string): Promise<string> {
  const memories = await recall({ query, limit: 10 })
  if (!memories.length) return 'Sin memoria previa relevante.'
  return memories
    .map((m) => `[${m.kind}] ${m.content}`)
    .join('\n')
}

export async function forget(id: string): Promise<void> {
  await db.agentMemory.delete({ where: { id } })
}

export async function listMemories(kind?: MemoryItem['kind']): Promise<MemoryItem[]> {
  const rows = await db.agentMemory.findMany({
    where: kind ? { kind } : {},
    orderBy: { importance: 'desc' },
    take: 100,
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as MemoryItem['kind'],
    key: r.key, content: r.content,
    importance: r.importance,
    tags: JSON.parse(r.tags || '[]') as string[],
    hits: r.hits,
    createdAt: new Date(r.createdAt),
    lastUsedAt: new Date(r.lastUsedAt),
  }))
}

// Extracción automática de lecciones tras una decisión/operación
export async function learnFromOutcome(input: {
  symbol: string
  outcome: 'win' | 'loss'
  pnlPct: number
  context: string
}): Promise<void> {
  const kind: MemoryItem['kind'] = 'lesson'
  const key = `lesson-${input.symbol}`
  const prev = await db.agentMemory.findFirst({ where: { key, kind } })
  const line = `${input.symbol} ${input.outcome === 'win' ? 'ganancia' : 'pérdida'} ${input.pnlPct.toFixed(2)}% — ${input.context}`
  if (prev) {
    const lines = prev.content.split('\n').slice(-9) // mantiene últimas 9
    await db.agentMemory.update({
      where: { id: prev.id },
      data: { content: [...lines, line].join('\n'), importance: Math.min(1, prev.importance + 0.05) },
    })
  } else {
    await db.agentMemory.create({
      data: { kind, key, content: line, importance: 0.6, tags: JSON.stringify([input.symbol, input.outcome]) },
    })
  }
}
