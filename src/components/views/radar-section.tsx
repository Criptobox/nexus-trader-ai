'use client'

// ─────────────────────────────────────────────────────────────
// Radar de Oportunidades — NEXUS en 3D aconseja dónde invertir
// · Escanea principales + tendencias globales + tus monedas
// · Puntuación 0-100 con tesis narrada y nivel de riesgo
// · El avatar celebra cuando hay zona de interés
// NO es asesoramiento financiero — herramienta educativa
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { Radar, RefreshCw, Sparkles, TrendingUp, TrendingDown, Eye, Flame, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { CoinIcon } from '@/components/coin-icon'
import { NexusAvatar3D, type Nexus3DState } from '@/components/agents/nexus-3d'
import { cn } from '@/lib/utils'

interface Opportunity {
  symbol: string
  name: string
  score: number
  scoreBreakdown: { momentum: number; trend: number; volume: number; structure: number; stability: number }
  type: 'EMERGENTE' | 'IMPULSO' | 'TENDENCIA' | 'REVERSION' | 'ESTABLE'
  action: 'ZONA DE INTERÉS' | 'VIGILAR' | 'OBSERVAR' | 'EVITAR'
  risk: 'bajo' | 'medio' | 'alto'
  thesis: string
  price: number
  momentum24h: number
  trend7d: number
  volume24h: number
  high24h: number
  imageUrl?: string
  trendingRank?: number
  isCustom?: boolean
  coingeckoId?: string
}

interface RadarResult {
  generatedAt: string
  source: string
  trendingCount: number
  scanned: number
  advice: string
  top: Opportunity | null
  opportunities: Opportunity[]
}

const TYPE_META: Record<Opportunity['type'], { label: string; cls: string }> = {
  EMERGENTE: { label: '🔥 Emergente', cls: 'bg-gold/15 text-gold' },
  IMPULSO: { label: '⚡ Impulso', cls: 'bg-primary/15 text-primary' },
  TENDENCIA: { label: '📈 Tendencia', cls: 'bg-primary/15 text-primary' },
  REVERSION: { label: '🩸 Reversión', cls: 'bg-bear/15 text-bear' },
  ESTABLE: { label: '🌊 Estable', cls: 'bg-surface-2 text-muted-foreground' },
}

const ACTION_CLS: Record<Opportunity['action'], string> = {
  'ZONA DE INTERÉS': 'bg-primary/15 text-primary ring-1 ring-primary/40',
  VIGILAR: 'bg-gold/15 text-gold ring-1 ring-gold/30',
  OBSERVAR: 'bg-surface-2 text-muted-foreground',
  EVITAR: 'bg-bear/15 text-bear ring-1 ring-bear/30',
}

const RISK_CLS: Record<Opportunity['risk'], string> = {
  bajo: 'text-primary',
  medio: 'text-gold',
  alto: 'text-bear',
}

function scoreColor(s: number) {
  return s >= 70 ? 'text-primary' : s >= 55 ? 'text-gold' : 'text-muted-foreground'
}

function OpportunityCard({ o, rank, onAsk }: { o: Opportunity; rank: number; onAsk: (o: Opportunity) => void }) {
  const up = o.momentum24h >= 0
  return (
    <div className="glass rounded-2xl p-3.5" data-testid={`radar-card-${o.symbol}`}>
      <div className="flex items-center gap-2.5">
        <span className="w-5 text-center font-mono text-[11px] font-bold text-muted-foreground">#{rank}</span>
        <CoinIcon symbol={o.symbol} src={o.imageUrl} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-bold">{o.symbol}</p>
            {o.isCustom && <span className="rounded bg-gold/15 px-1 py-px text-[8px] font-bold text-gold">TUYA</span>}
            {o.trendingRank && o.trendingRank <= 3 && (
              <span className="flex items-center gap-0.5 rounded bg-gold/15 px-1 py-px text-[8px] font-bold text-gold">
                <Flame size={9} /> TOP {o.trendingRank}
              </span>
            )}
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{o.name}</p>
        </div>
        <div className="text-right">
          <p className={cn('font-mono text-base font-black leading-none', scoreColor(o.score))}>{o.score}</p>
          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">score</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
        <span className={cn('rounded-full px-1.5 py-0.5', TYPE_META[o.type].cls)}>{TYPE_META[o.type].label}</span>
        <span className={cn('rounded-full px-1.5 py-0.5', ACTION_CLS[o.action])}>{o.action}</span>
        <span className={cn('rounded-full bg-surface-2 px-1.5 py-0.5', RISK_CLS[o.risk])}>riesgo {o.risk}</span>
        <span className={cn('ml-auto flex items-center gap-0.5 font-mono', up ? 'text-bull' : 'text-bear')}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {up ? '+' : ''}{o.momentum24h.toFixed(1)}%
        </span>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {([
          ['Mom', o.scoreBreakdown.momentum],
          ['Trend', o.scoreBreakdown.trend],
          ['Vol', o.scoreBreakdown.volume],
          ['Struct', o.scoreBreakdown.structure],
          ['Stab', o.scoreBreakdown.stability],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface/70 px-1.5 py-1">
            <div className="flex items-center justify-between text-[7px] text-muted-foreground">
              <span>{label}</span><span className="font-mono">{value}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-muted-foreground">{o.thesis}</p>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => onAsk(o)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary/15 py-1.5 text-[11px] font-bold text-primary transition-colors active:bg-primary/25"
        >
          <Sparkles size={12} /> Analizar con el comité
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">
          ${o.price >= 1 ? o.price.toFixed(2) : o.price.toPrecision(3)}
        </span>
      </div>
    </div>
  )
}

export function RadarSection() {
  const customCoins = useAppStore((s) => s.customCoins)
  const setView = useAppStore((s) => s.setView)
  const [result, setResult] = useState<RadarResult | null>(null)
  const [loading, setLoading] = useState(true)

  const scan = useCallback(async () => {
    setLoading(true)
    try {
      const ids = customCoins.map((c) => c.id).join(',')
      const res = await fetch(`/api/opportunities${ids ? `?ids=${encodeURIComponent(ids)}` : ''}`).then((r) => r.json())
      if (res && !res.error) setResult(res)
    } catch { /* silencioso */ }
    setLoading(false)
  }, [customCoins])

  useEffect(() => {
    const t = setTimeout(scan, 400)
    return () => clearTimeout(t)
  }, [scan])

  const avatarState: Nexus3DState = loading
    ? 'thinking'
    : result?.top?.action === 'ZONA DE INTERÉS'
      ? 'happy'
      : 'speaking'

  const askNexus = (o: Opportunity) => {
    try {
      sessionStorage.setItem(
        'nexus-chat-prefill',
        JSON.stringify({
          text: `Analiza ${o.symbol} para invertir: dame el veredicto del comité con entrada, stop y objetivo.`,
          cgId: o.coingeckoId,
        }),
      )
    } catch { /* ignora */ }
    setView('agent')
  }

  const list = result?.opportunities ?? []

  return (
    <section aria-label="Radar de oportunidades" className="glass relative overflow-hidden rounded-3xl p-4" data-testid="radar-section">
      <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-gold/10 blur-3xl" />

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Radar size={16} className="text-gold" /> Radar de Oportunidades
        </h2>
        <button
          onClick={scan}
          disabled={loading}
          aria-label="Volver a escanear el mercado"
          className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition-colors active:bg-surface"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Escanear
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {loading
          ? 'Escaneando mercado, tendencias globales y tus monedas…'
          : `${result?.scanned ?? 0} activos analizados${result?.trendingCount ? ` · ${result.trendingCount} en tendencias globales` : ''} · fuente ${result?.source ?? '—'}`}
      </p>

      {/* NEXUS aconseja */}
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="relative flex flex-col items-center">
          <NexusAvatar3D state={avatarState} height={190} interactive />
          <div className="glass-strong relative mt-1 max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2.5" data-testid="radar-advice">
            <p className="text-[11px] font-bold text-primary">NEXUS aconseja</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {loading ? 'Analizando momentum, volumen y riesgos para ti…' : result?.advice}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {loading && list.length === 0
            ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-2/60" />)
            : list.slice(0, 3).map((o, i) => <OpportunityCard key={o.symbol} o={o} rank={i + 1} onAsk={askNexus} />)}
          {!loading && list.length === 0 && (
            <div className="flex h-full min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-4 text-center">
              <ShieldAlert size={20} className="text-muted-foreground" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Sin datos del radar ahora mismo. Pulsa «Escanear» para reintentar.</p>
            </div>
          )}
        </div>
      </div>

      {/* el resto como chips compactos */}
      {list.length > 3 && (
        <div className="nexus-scroll mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {list.slice(3).map((o) => (
            <button
              key={o.symbol}
              onClick={() => askNexus(o)}
              className="glass flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition-transform active:scale-95"
            >
              <CoinIcon symbol={o.symbol} src={o.imageUrl} size={16} />
              <span className="font-bold">{o.symbol}</span>
              <span className={cn('font-mono', scoreColor(o.score))}>{o.score}</span>
              <ArrowUpRight size={11} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <p className="mt-2.5 flex items-center gap-1 text-[9px] leading-snug text-muted-foreground">
        <Eye size={10} className="shrink-0" />
        Herramienta educativa, no es asesoramiento financiero. Las criptomonedas son activos de alto riesgo: nunca inviertas más de lo que puedes permitirte perder.
      </p>
    </section>
  )
}
