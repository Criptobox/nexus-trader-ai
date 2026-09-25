'use client'

// ─────────────────────────────────────────────────────────────
// Conocimiento — artículos, glosario y memoria del agente
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { Search, BookOpen, Brain, Trash2, GraduationCap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { KBArticle } from '@/lib/knowledge/kb'

interface MemoryItem {
  id: string
  kind: string
  key: string
  content: string
  importance: number
  hits: number
}

const KIND_LABEL: Record<string, string> = {
  episodic: 'Episódica',
  semantic: 'Semántica',
  preference: 'Preferencia',
  lesson: 'Lección',
}

export function KnowledgeView() {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [glossary, setGlossary] = useState<{ term: string; def: string }[]>([])
  const [search, setSearch] = useState('')
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [openArticle, setOpenArticle] = useState<KBArticle | null>(null)

  useEffect(() => {
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    fetch(`/api/knowledge${q}`).then((r) => r.json()).then((res) => {
      if (res.articles) setArticles(res.articles)
      if (res.glossary) setGlossary(res.glossary)
    }).catch(() => null)
    fetch('/api/knowledge?memories=1').then((r) => r.json()).then((res) => {
      if (res.memories) setMemories(res.memories)
    }).catch(() => null)
  }, [search])

  const forgetMemory = async (id: string) => {
    await fetch('/api/knowledge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forget', id }),
    })
    setMemories((m) => m.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <h2 className="px-1 text-lg font-bold">Base de conocimientos</h2>

      <Tabs defaultValue="articulos">
        <TabsList className="glass grid w-full grid-cols-3 rounded-2xl p-1">
          <TabsTrigger value="articulos" className="rounded-xl text-xs">📚 Artículos</TabsTrigger>
          <TabsTrigger value="glosario" className="rounded-xl text-xs">🔤 Glosario</TabsTrigger>
          <TabsTrigger value="memoria" className="rounded-xl text-xs">🧠 Memoria</TabsTrigger>
        </TabsList>

        {/* artículos */}
        <TabsContent value="articulos" className="mt-3 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar: riesgo, RSI, velas, seguridad…"
              className="glass border-0 pl-9 text-sm"
            />
          </div>
          {articles.map((a) => (
            <button key={a.id} onClick={() => setOpenArticle(a)} className="glass w-full rounded-2xl p-4 text-left transition-colors active:bg-surface-2">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
                <p className="flex-1 text-sm font-bold leading-snug">{a.title}</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{a.summary}</p>
              <div className="mt-2 flex gap-1.5">
                <Badge variant="secondary" className="rounded-full text-[9px]">{a.category}</Badge>
                <Badge variant="secondary" className="rounded-full text-[9px]">{a.level}</Badge>
              </div>
            </button>
          ))}
        </TabsContent>

        {/* glosario */}
        <TabsContent value="glosario" className="mt-3 space-y-2">
          {glossary.map((g) => (
            <div key={g.term} className="glass rounded-2xl p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gold">
                <GraduationCap size={14} /> {g.term}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{g.def}</p>
            </div>
          ))}
        </TabsContent>

        {/* memoria */}
        <TabsContent value="memoria" className="mt-3 space-y-2">
          <div className="glass flex items-start gap-2.5 rounded-2xl p-3.5">
            <Brain size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              La memoria del agente registra análisis, operaciones y tus preferencias. Los recuerdos con mayor
              importancia se usan antes en cada conversación. Puedes borrar cualquiera.
            </p>
          </div>
          {memories.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-xs text-muted-foreground">
              La memoria se llena sola al analizar monedas, operar y conversar con el agente.
            </div>
          ) : memories.map((m) => (
            <div key={m.id} className="glass flex items-start gap-2.5 rounded-2xl p-3.5">
              <Badge variant="secondary" className="mt-0.5 shrink-0 rounded-full text-[9px]">{KIND_LABEL[m.kind] ?? m.kind}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-snug">{m.content}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">importancia {(m.importance * 100).toFixed(0)}% · {m.hits} usos</p>
              </div>
              <button onClick={() => forgetMemory(m.id)} aria-label="Olvidar" className="shrink-0 rounded-lg p-1.5 text-muted-foreground active:scale-95">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* lector de artículo */}
      {openArticle && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
          onClick={() => setOpenArticle(null)}
          role="dialog" aria-modal="true" aria-label={openArticle.title}
        >
          <div
            className="nexus-scroll glass-strong max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
            <h3 className="text-lg font-bold leading-snug">{openArticle.title}</h3>
            <div className="mt-1.5 flex gap-1.5">
              <Badge variant="secondary" className="rounded-full text-[9px]">{openArticle.category}</Badge>
              <Badge variant="secondary" className="rounded-full text-[9px]">{openArticle.level}</Badge>
            </div>
            <div className="mt-4 space-y-2.5">
              {openArticle.content.split('\n').filter(Boolean).map((p, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-foreground/90">{p}</p>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {openArticle.tags.map((t) => <Badge key={t} variant="outline" className="rounded-full text-[9px]">#{t}</Badge>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
