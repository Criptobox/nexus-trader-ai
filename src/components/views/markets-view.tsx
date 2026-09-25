'use client'

// ─────────────────────────────────────────────────────────────
// Mercados — 20 monedas base + CUALQUIER moneda que el usuario
// añada (búsqueda CoinGecko con logos originales oficiales),
// persistencia local, detalle con velas e indicadores.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, ArrowLeft, X, BrainCircuit, Plus, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CoinIcon } from '@/components/coin-icon'
import { Sparkline, CandleChart } from '@/components/charts/candle-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { Quote, CustomCoin } from '@/lib/types'
import type { TechnicalSnapshot } from '@/lib/indicators'
import type { Candle } from '@/lib/types'

const INTERVALS = ['15m', '1h', '4h', '1d'] as const

interface DetailData {
  symbol: string
  interval: string
  candles: Candle[]
  source: 'binance' | 'demo' | 'coingecko'
  technical: TechnicalSnapshot
}

interface SearchRow {
  id: string
  symbol: string
  name: string
  image: string
  rank: number | null
}

export function MarketsView() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customQuotes, setCustomQuotes] = useState<Quote[]>([])
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<{ symbol: string; cgId?: string } | null>(null)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [interval, setIntervalState] = useState<(typeof INTERVALS)[number]>('1h')
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ── hoja "añadir moneda" ──
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setView = useAppStore((s) => s.setView)
  const customCoins = useAppStore((s) => s.customCoins)
  const addCustomCoin = useAppStore((s) => s.addCustomCoin)
  const removeCustomCoin = useAppStore((s) => s.removeCustomCoin)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market').then((r) => r.json())
      if (res.quotes) {
        setQuotes(res.quotes)
        useAppStore.getState().setMarketSource(res.source)
      }
    } catch { /* silencioso */ }
    setLoading(false)
  }, [])

  const loadCustom = useCallback(async (coins: CustomCoin[]) => {
    if (coins.length === 0) { setCustomQuotes([]); return }
    try {
      const res = await fetch(`/api/market?ids=${coins.map((c) => c.id).join(',')}`).then((r) => r.json())
      if (res.customQuotes) setCustomQuotes(res.customQuotes)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (mounted) loadCustom(customCoins)
  }, [customCoins, mounted, loadCustom])

  // cotizaciones combinadas: tus monedas primero
  const allQuotes = useMemo(() => {
    const base = quotes.filter((q) => !customQuotes.some((c) => c.symbol === q.symbol))
    return [...customQuotes, ...base]
  }, [quotes, customQuotes])

  // ── búsqueda CoinGecko con debounce ──
  useEffect(() => {
    if (!addOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`).then((r) => r.json())
        setResults(res.results ?? [])
      } catch { setResults([]) }
      setSearching(false)
    }, 420)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, addOpen])

  // ── detalle + velas (base o custom) ──
  const loadDetail = useCallback(async (symbol: string, cgId: string | undefined, inter: string) => {
    setDetailData(null)
    try {
      const cg = cgId ? `&cg=${encodeURIComponent(cgId)}` : ''
      const res = await fetch(`/api/market?symbol=${symbol}&candles=${inter}&limit=200${cg}`).then((r) => r.json())
      setDetailData(res)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    if (detail) loadDetail(detail.symbol, detail.cgId, interval)
  }, [detail, interval, loadDetail])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allQuotes.filter((qq) =>
      qq.symbol.toLowerCase().includes(q) || (qq.name ?? '').toLowerCase().includes(q))
  }, [allQuotes, search])

  const openDetail = (symbol: string, cgId?: string) => {
    useAppStore.getState().setSelectedSymbol(symbol)
    setDetail({ symbol, cgId })
    setIntervalState('1h')
  }

  const runAgentAnalysis = async (symbol: string, cgId?: string) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, cgId }),
      }).then((r) => r.json())
      sessionStorage.setItem('nexus-analysis-current', JSON.stringify(res))
      setAnalyzing(false)
      setDetail(null)
      setView('agent')
    } catch {
      setAnalyzing(false)
    }
  }

  const detailQuote = detail ? allQuotes.find((q) => q.symbol === detail.symbol) : undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">Mercados</h2>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {loading ? '' : useAppStore.getState().marketSource === 'binance' ? 'Binance en vivo'
            : useAppStore.getState().marketSource === 'coingecko' ? 'CoinGecko en vivo' : 'Datos demo sintéticos'}
        </span>
      </div>

      {/* buscador local */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cripto (BTC, PEPE, SOL…)"
          className="glass border-0 pl-9 text-sm"
          aria-label="Buscar criptomoneda"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Mis monedas (custom, con logo original) ── */}
      {mounted && customCoins.length > 0 && (
        <section aria-label="Mis monedas añadidas" className="space-y-1.5">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mis monedas</p>
          <div className="nexus-scroll flex gap-2 overflow-x-auto pb-1">
            {customCoins.map((c) => (
              <div key={c.id} className="glass relative flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-2.5 pr-8">
                <button onClick={() => openDetail(c.symbol, c.id)} className="flex items-center gap-2" aria-label={`Ver ${c.name}`}>
                  <CoinIcon symbol={c.symbol} src={c.image} size={26} />
                  <span className="text-xs font-bold">{c.symbol}</span>
                </button>
                <button
                  onClick={() => removeCustomCoin(c.id)}
                  aria-label={`Quitar ${c.name}`}
                  className="absolute right-1.5 top-1.5 rounded-full bg-surface-2 p-0.5 text-muted-foreground transition-colors hover:text-bear"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* botón añadir moneda */}
      <button
        onClick={() => { setAddOpen(true); setQuery(''); setResults([]) }}
        className="glass flex w-full items-center justify-center gap-2 rounded-2xl border-dashed py-3 text-sm font-semibold text-primary transition-colors active:bg-surface-2"
        aria-label="Añadir cualquier moneda"
      >
        <Plus size={16} />
        Añadir cualquier moneda <span className="text-[10px] font-normal text-muted-foreground">(+13.000 con logo original)</span>
      </button>

      {/* lista combinada */}
      <div className="space-y-1.5">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : filtered.map((q) => (
            <button
              key={`${q.symbol}-${q.coingeckoId ?? 'base'}`}
              onClick={() => openDetail(q.symbol, q.coingeckoId)}
              className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors active:bg-surface-2"
            >
              <CoinIcon symbol={q.symbol} src={q.imageUrl} size={38} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{q.symbol}{q.coingeckoId && <span className="ml-1.5 rounded bg-primary/15 px-1 py-0.5 text-[8px] font-bold text-primary">TUYA</span>}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {q.name ? `${q.name} · ` : ''}Vol ${q.volume24h >= 1e9 ? `${(q.volume24h / 1e9).toFixed(1)}B` : `${(q.volume24h / 1e6).toFixed(0)}M`}
                </p>
              </div>
              <Sparkline values={q.spark} up={q.change24h >= 0} width={64} height={26} />
              <div className="w-20 text-right">
                <p className="font-mono text-sm font-semibold">${q.price >= 1 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : q.price.toPrecision(4)}</p>
                <p className={`font-mono text-[11px] font-semibold ${q.change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {q.change24h >= 0 ? '+' : ''}{q.change24h.toFixed(2)}%
                </p>
              </div>
            </button>
          ))}
        {!loading && filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Sin resultados para “{search}”</p>
            <button onClick={() => { setAddOpen(true); setQuery(search) }} className="mt-2 text-xs font-semibold text-primary">
              ¿Buscarla en CoinGecko y añadirla?
            </button>
          </div>
        )}
      </div>

      {/* ── Sheet: añadir cualquier moneda ── */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="nexus-scroll max-h-[88dvh] overflow-y-auto rounded-t-3xl border-0 bg-[#0E1422] px-4 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-left text-base font-bold">Añadir cualquier moneda</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Busca entre +13.000 criptomonedas de CoinGecko. Se añadirán con su logo original y datos en vivo.
          </p>

          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej.: Pepe, Bonk, Chainlink, SOL…"
              className="glass border-0 pl-9 text-sm"
              autoFocus
              aria-label="Buscar moneda en CoinGecko"
            />
          </div>

          {/* ya añadidas */}
          {mounted && customCoins.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customCoins.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1.5 pr-2.5 text-[11px] font-semibold text-primary">
                  <CoinIcon symbol={c.symbol} src={c.image} size={16} />
                  {c.symbol}
                  <button onClick={() => removeCustomCoin(c.id)} aria-label={`Quitar ${c.name}`} className="text-primary/60 hover:text-bear">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            {searching && (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            )}
            {!searching && results.map((r) => {
              const added = customCoins.some((c) => c.id === r.id)
              return (
                <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-2.5">
                  <CoinIcon symbol={r.symbol} src={r.image} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.name} <span className="text-[10px] font-medium text-muted-foreground">{r.symbol}</span></p>
                    <p className="text-[10px] text-muted-foreground">{r.rank ? `#${r.rank} por capitalización` : 'Sin ranking'}</p>
                  </div>
                  {added ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold text-primary">
                      <Check size={13} /> Añadida
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => addCustomCoin({ id: r.id, symbol: r.symbol, name: r.name, image: r.image })}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
                    >
                      <Plus size={13} /> Añadir
                    </Button>
                  )}
                </div>
              )
            })}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Sin resultados — prueba otro nombre o símbolo</p>
            )}
            {!searching && query.trim().length < 2 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Escribe al menos 2 letras para buscar</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sheet de detalle ── */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="bottom" className="nexus-scroll max-h-[92dvh] overflow-y-auto rounded-t-3xl border-0 bg-[#0E1422] px-4 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Detalle de {detail?.symbol}</SheetTitle>
            {detail && (
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setDetail(null)} aria-label="Volver" className="rounded-full bg-surface-2 p-2">
                  <ArrowLeft size={16} />
                </button>
                <CoinIcon symbol={detail.symbol} src={detailQuote?.imageUrl} size={36} />
                <div className="flex-1">
                  <p className="text-base font-bold">{detailQuote?.name ?? detail.symbol}/USDT</p>
                  {detailData && (
                    <p className={`font-mono text-sm font-bold ${detailData.technical && (detailQuote?.change24h ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                      ${detailData.technical ? detailData.technical.price.toPrecision(6) : '—'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </SheetHeader>

          {/* intervalos */}
          <div className="mt-4 flex gap-1.5">
            {INTERVALS.map((i) => (
              <button
                key={i}
                onClick={() => setIntervalState(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${interval === i ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground'}`}
              >
                {i}
              </button>
            ))}
            <Button
              size="sm"
              className="ml-auto h-8 gap-1.5 rounded-lg bg-gold/15 px-3 text-xs font-bold text-gold hover:bg-gold/25"
              disabled={analyzing}
              onClick={() => detail && runAgentAnalysis(detail.symbol, detail.cgId)}
            >
              <BrainCircuit size={14} />
              {analyzing ? 'Analizando…' : 'Analizar con agentes'}
            </Button>
          </div>

          {/* gráfico */}
          <div className="glass mt-3 rounded-2xl p-3">
            {detailData ? (
              <CandleChart candles={detailData.candles} height={250} />
            ) : (
              <Skeleton className="h-[250px] w-full rounded-xl" />
            )}
          </div>

          {/* indicadores técnicos */}
          {detailData?.technical && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Tendencia', value: detailData.technical.trend === 'up' ? 'Alcista' : detailData.technical.trend === 'down' ? 'Bajista' : 'Lateral' },
                { label: 'RSI 14', value: detailData.technical.rsi14?.toFixed(1) ?? '—' },
                { label: 'Momentum', value: `${detailData.technical.momentumScore > 0 ? '+' : ''}${detailData.technical.momentumScore}` },
                { label: 'ATR %', value: detailData.technical.atrPct?.toFixed(2) ?? '—' },
                { label: 'Soporte', value: detailData.technical.support.toPrecision(5) },
                { label: 'Resistencia', value: detailData.technical.resistance.toPrecision(5) },
              ].map((m) => (
                <div key={m.label} className="glass rounded-xl p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                  <p className={`mt-0.5 font-mono text-xs font-bold ${
                    m.value === 'Alcista' ? 'text-bull' : m.value === 'Bajista' ? 'text-bear' : ''}`}>
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {detailData?.source === 'coingecko' && (
            <p className="mt-3 rounded-xl bg-sky-400/10 px-3 py-2 text-center text-[10px] text-sky-300">
              Datos de CoinGecko (moneda sin par directo en Binance). Granularidad aproximada según intervalo.
            </p>
          )}
          {detailData?.source === 'demo' && (
            <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-center text-[10px] text-gold">
              Datos sintéticos (demo). Con acceso a internet se conectará automáticamente a Binance o CoinGecko.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
