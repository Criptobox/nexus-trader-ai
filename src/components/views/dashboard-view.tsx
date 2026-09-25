'use client'

// ─────────────────────────────────────────────────────────────
// Dashboard — resumen del portafolio, mercado, agente y riesgo
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Activity, BrainCircuit, ShieldCheck, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { CoinIcon } from '@/components/coin-icon'
import { Sparkline } from '@/components/charts/candle-chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { Quote } from '@/lib/types'
import { NexusAvatar } from '@/components/agents/nexus-avatar'
import { RadarSection } from '@/components/views/radar-section'

interface PortfolioMini {
  equity: number
  totalPnl: number
  totalPnlPct: number
  unrealizedPnl: number
  account: { startingBalance: number; baseCurrency: string; cash: number }
  positions: { id: string; symbol: string; unrealizedPct: number }[]
}

interface DecisionMini {
  id: string
  symbol: string
  action: string
  confidence: number
  createdAt: string
}

export function DashboardView() {
  const setView = useAppStore((s) => s.setView)
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol)
  const marketSource = useAppStore((s) => s.marketSource)
  const killSwitch = useAppStore((s) => s.killSwitch)

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioMini | null>(null)
  const [decisions, setDecisions] = useState<DecisionMini[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [mRes, pRes, dRes] = await Promise.all([
        fetch('/api/market').then((r) => r.json()),
        fetch('/api/paper').then((r) => r.json()),
        fetch('/api/agent/analyze').then((r) => r.json()),
      ])
      if (mRes.quotes) setQuotes(mRes.quotes)
      if (mRes.source) useAppStore.getState().setMarketSource(mRes.source)
      if (!pRes.error) setPortfolio(pRes)
      if (dRes.decisions) setDecisions(dRes.decisions.slice(0, 4))
    } catch { /* silencioso */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    const initial = setTimeout(load, 0)
    const t = setInterval(load, 30000)
    return () => { clearTimeout(initial); clearInterval(t) }
  }, [load])

  const pnlUp = (portfolio?.totalPnl ?? 0) >= 0
  const movers = [...quotes].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 4)

  return (
    <div className="space-y-4">
      {/* ── Equity card ── */}
      <section aria-label="Resumen del portafolio" className="glass relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Equity (Paper Trading)</p>
            {loading ? (
              <Skeleton className="mt-1 h-9 w-40" />
            ) : (
              <p className="mt-0.5 font-mono text-3xl font-bold tracking-tight">
                {portfolio ? `${portfolio.equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                <span className="ml-1 text-sm text-muted-foreground">{portfolio?.account.baseCurrency ?? 'USDT'}</span>
              </p>
            )}
            {portfolio && (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className={`flex items-center gap-0.5 font-semibold ${pnlUp ? 'text-bull' : 'text-bear'}`}>
                  {pnlUp ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  {pnlUp ? '+' : ''}{portfolio.totalPnl.toFixed(2)} ({portfolio.totalPnlPct.toFixed(2)}%)
                </span>
                <span className="text-[11px] text-muted-foreground">desde {portfolio.account.startingBalance.toLocaleString()}</span>
              </div>
            )}
          </div>
          <span className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-bold ${marketSource === 'binance' ? 'bg-primary/15 text-primary' : 'bg-gold/15 text-gold'}`}>
            <Activity size={13} />
            {marketSource === 'binance' ? 'BINANCE LIVE' : 'MODO DEMO'}
          </span>
        </div>

        {/* mini posiciones */}
        {portfolio && portfolio.positions.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto nexus-scroll pb-1">
            {portfolio.positions.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedSymbol(p.symbol); setView('markets') }}
                className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium"
              >
                <CoinIcon symbol={p.symbol} size={16} />
                {p.symbol}
                <span className={p.unrealizedPct >= 0 ? 'text-bull' : 'text-bear'}>
                  {p.unrealizedPct >= 0 ? '+' : ''}{p.unrealizedPct.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Ticker marquee ── */}
      <section aria-label="Cotizaciones" className="glass overflow-hidden rounded-2xl py-2.5">
        {quotes.length === 0 ? (
          <Skeleton className="mx-4 h-6 w-full" />
        ) : (
          <div className="animate-marquee flex w-max gap-8 px-4">
            {[...quotes, ...quotes].map((q, i) => (
              <button
                key={`${q.symbol}-${i}`}
                className="flex items-center gap-1.5 text-xs"
                onClick={() => { setSelectedSymbol(q.symbol); setView('markets') }}
              >
                <span className="font-bold">{q.symbol}</span>
                <span className="font-mono text-muted-foreground">${q.price >= 1 ? q.price.toFixed(2) : q.price.toPrecision(3)}</span>
                <span className={`font-mono font-semibold ${q.change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {q.change24h >= 0 ? '+' : ''}{q.change24h.toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Acción rápida: agente ── */}
      <section aria-label="Acceso al agente">
        <button
          onClick={() => setView('agent')}
          className="glass group flex w-full items-center gap-4 rounded-3xl p-4 text-left transition-transform active:scale-[0.99]"
        >
          <NexusAvatar size={56} state="speaking" />
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              Habla con NEXUS <Sparkles size={14} className="text-primary" />
            </p>
            <p className="text-[12px] leading-snug text-muted-foreground">
              Voz o texto · Vega, Scout, Aegis, Atlas y Lyra a tu servicio
            </p>
          </div>
          <ArrowUpRight size={20} className="text-primary transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      {/* ── Radar de Oportunidades (NEXUS aconseja) ── */}
      <RadarSection />

      {/* ── Top movers ── */}
      <section aria-label="Mayores movimientos" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><TrendingUp size={15} className="text-primary" /> Mayores movimientos 24h</h2>
          <button className="text-xs font-medium text-primary" onClick={() => setView('markets')}>Ver todos</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            : movers.map((q) => (
              <button
                key={q.symbol}
                onClick={() => { setSelectedSymbol(q.symbol); setView('markets') }}
                className="glass flex items-center justify-between rounded-2xl p-3 text-left transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <CoinIcon symbol={q.symbol} size={30} />
                  <div>
                    <p className="text-xs font-bold">{q.symbol}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">${q.price >= 1 ? q.price.toFixed(2) : q.price.toPrecision(3)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-bold ${q.change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {q.change24h >= 0 ? '+' : ''}{q.change24h.toFixed(2)}%
                  </span>
                  <Sparkline values={q.spark} up={q.change24h >= 0} width={56} height={20} />
                </div>
              </button>
            ))}
        </div>
      </section>

      {/* ── Estado del sistema ── */}
      <section aria-label="Estado del sistema" className="grid grid-cols-2 gap-2.5">
        <button onClick={() => setView('risk')} className="glass flex items-center gap-3 rounded-2xl p-3.5 text-left">
          {killSwitch?.active
            ? <ShieldAlert size={22} className="text-bear" />
            : <ShieldCheck size={22} className="text-primary" />}
          <div>
            <p className="text-[11px] font-semibold">{killSwitch?.active ? 'Trading detenido' : 'Sistemas activos'}</p>
            <p className="text-[10px] text-muted-foreground">Risk Engine · Kill Switch</p>
          </div>
        </button>
        <button onClick={() => setView('agent')} className="glass flex items-center gap-3 rounded-2xl p-3.5 text-left">
          <BrainCircuit size={22} className="text-gold" />
          <div>
            <p className="text-[11px] font-semibold">Última decisión</p>
            <p className="text-[10px] text-muted-foreground">
              {decisions[0] ? `${decisions[0].symbol}: ${decisions[0].action.toUpperCase()} (${Math.round(decisions[0].confidence * 100)}%)` : 'Ejecuta un análisis'}
            </p>
          </div>
        </button>
      </section>
    </div>
  )
}
