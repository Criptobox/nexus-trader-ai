'use client'

// ─────────────────────────────────────────────────────────────
// Portafolio — paper trading: equity, posiciones, órdenes, ticket
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, RefreshCcw, X, RotateCcw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { AreaChartSimple } from '@/components/charts/area-chart'
import { CoinIcon } from '@/components/coin-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import type { PortfolioSummary } from '@/lib/trading/paper-engine'
import { cn } from '@/lib/utils'

export function PortfolioView() {
  const [data, setData] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const { toast } = useToast()
  const bumpRefresh = useAppStore((s) => s.bumpRefresh)
  const refreshKey = useAppStore((s) => s.refreshKey)
  const killSwitch = useAppStore((s) => s.killSwitch)

  // ticket
  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [usd, setUsd] = useState('500')
  const [useAgentSizing, setUseAgentSizing] = useState(false)
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/paper').then((r) => r.json())
      if (!res.error) setData(res)
    } catch { /* silencioso */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    const initial = setTimeout(load, 0)
    const t = setInterval(load, 25000)
    return () => { clearTimeout(initial); clearInterval(t) }
  }, [load, refreshKey])

  const placeOrder = async () => {
    setPlacing(true)
    try {
      const res = await fetch('/api/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'order',
          symbol, side,
          type: 'market',
          usdAmount: Number(usd),
          stopLoss: stopLoss ? Number(stopLoss) : undefined,
          takeProfit: takeProfit ? Number(takeProfit) : undefined,
          source: 'manual',
        }),
      }).then((r) => r.json())
      toast({
        title: res.ok ? '✅ Orden ejecutada' : '⛔ Orden rechazada',
        description: res.message,
        variant: res.ok ? 'default' : 'destructive',
      })
      if (res.ok) setTicketOpen(false)
      load()
      bumpRefresh()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
    setPlacing(false)
  }

  const closePosition = async (positionId: string) => {
    try {
      const res = await fetch('/api/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', positionId }),
      }).then((r) => r.json())
      toast({ title: res.ok ? '✅ Posición cerrada' : 'Error', description: res.message })
      load()
      bumpRefresh()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  const resetAccount = async () => {
    try {
      await fetch('/api/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      toast({ title: 'Cuenta paper reiniciada', description: 'Balance restaurado al capital inicial.' })
      load()
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }

  const pnlUp = (data?.totalPnl ?? 0) >= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">Portafolio Paper</h2>
        <div className="flex gap-2">
          <button onClick={load} aria-label="Refrescar" className="glass rounded-xl p-2"><RefreshCcw size={15} /></button>
          <button onClick={resetAccount} aria-label="Reiniciar cuenta" className="glass rounded-xl p-2 text-gold"><RotateCcw size={15} /></button>
        </div>
      </div>

      {/* resumen */}
      <section className="glass rounded-3xl p-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : data ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Equity total</p>
                <p className="mt-0.5 font-mono text-3xl font-bold">
                  ${data.equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-sm">
                  <span className={`flex items-center font-bold ${pnlUp ? 'text-bull' : 'text-bear'}`}>
                    {pnlUp ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    {pnlUp ? '+' : ''}{data.totalPnl.toFixed(2)} ({data.totalPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <p>Efectivo: <span className="font-mono text-foreground">${data.account.cash.toFixed(0)}</span></p>
                <p>Invertido: <span className="font-mono text-foreground">${data.positionsValue.toFixed(0)}</span></p>
                <p>Irrealizado: <span className={cn('font-mono font-bold', data.unrealizedPnl >= 0 ? 'text-bull' : 'text-bear')}>
                  {data.unrealizedPnl >= 0 ? '+' : ''}{data.unrealizedPnl.toFixed(2)}
                </span></p>
              </div>
            </div>
            {data.equityCurve.length > 2 && (
              <div className="mt-3">
                <AreaChartSimple data={data.equityCurve} up={pnlUp} height={120} />
              </div>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground">No se pudo cargar el portafolio.</p>}
      </section>

      {/* stats rápidos */}
      {data && (
        <section className="grid grid-cols-4 gap-2">
          {[
            { label: 'Cierres', value: String(data.stats.totalClosed) },
            { label: 'Win rate', value: `${data.stats.winRate.toFixed(0)}%` },
            { label: 'Mejor', value: `+${data.stats.bestPnl.toFixed(0)}` },
            { label: 'Peor', value: `${data.stats.worstPnl.toFixed(0)}` },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={cn('mt-0.5 font-mono text-sm font-bold', s.label === 'Mejor' ? 'text-bull' : s.label === 'Peor' ? 'text-bear' : '')}>
                {s.value}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ticket de orden */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 rounded-2xl bg-primary py-6 text-base font-bold text-primary-foreground" disabled={!!killSwitch?.active}>
            <Wallet size={18} />
            {killSwitch?.active ? 'Kill Switch activo — trading detenido' : 'Nueva operación paper'}
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Ticket de orden (paper)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide('buy')}
                className={cn('rounded-xl py-2.5 text-sm font-bold transition-colors', side === 'buy' ? 'bg-primary text-primary-foreground' : 'glass text-muted-foreground')}>
                COMPRAR
              </button>
              <button onClick={() => setSide('sell')}
                className={cn('rounded-xl py-2.5 text-sm font-bold transition-colors', side === 'sell' ? 'bg-bear text-white' : 'glass text-muted-foreground')}>
                VENDER
              </button>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Moneda</label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6))} className="glass border-0 font-mono" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Monto (USDT)</label>
              <Input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="glass border-0 font-mono" />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <div>
                <p className="text-[11px] font-semibold">Tamaño sugerido por Risk Engine</p>
                <p className="text-[10px] text-muted-foreground">Limita el riesgo al % configurado con stop 3%</p>
              </div>
              <Switch checked={useAgentSizing} onCheckedChange={setUseAgentSizing} />
            </div>
            {useAgentSizing && (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-[10px] text-primary">
                El Risk Engine recortará el tamaño automáticamente si excede el riesgo por operación.
                Deja el monto alto (p. ej. 10000) y el motor lo ajustará.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Stop Loss (opcional)</label>
                <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="auto 3%" className="glass border-0 font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Take Profit (opcional)</label>
                <Input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="auto 6%" className="glass border-0 font-mono text-xs" />
              </div>
            </div>
            <Button onClick={placeOrder} disabled={placing || !usd} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">
              {placing ? 'Enviando…' : `Enviar ${side === 'buy' ? 'compra' : 'venta'} ${symbol}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* posiciones abiertas */}
      <section className="space-y-2">
        <h3 className="px-1 text-sm font-bold">Posiciones abiertas ({data?.positions.length ?? 0})</h3>
        {!data || data.positions.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-xs text-muted-foreground">
            Sin posiciones abiertas. Abre tu primera operación paper o pídeselo al agente.
          </div>
        ) : data.positions.map((p) => (
          <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <CoinIcon symbol={p.symbol} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                {p.symbol}
                <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', p.side === 'long' ? 'bg-primary/15 text-primary' : 'bg-bear/15 text-bear')}>
                  {p.side === 'long' ? 'LONG' : 'SHORT'}
                </span>
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {p.qty.toPrecision(5)} @ {p.entryPrice.toPrecision(6)} → {p.currentPrice.toPrecision(6)}
              </p>
              {(p.stopLoss || p.takeProfit) && (
                <p className="text-[9px] text-muted-foreground">
                  SL {p.stopLoss ? p.stopLoss.toPrecision(5) : '—'} · TP {p.takeProfit ? p.takeProfit.toPrecision(5) : '—'}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className={cn('font-mono text-sm font-bold', p.unrealizedPnl >= 0 ? 'text-bull' : 'text-bear')}>
                {p.unrealizedPnl >= 0 ? '+' : ''}{p.unrealizedPnl.toFixed(2)}
              </p>
              <p className={cn('font-mono text-[10px] font-semibold', p.unrealizedPct >= 0 ? 'text-bull' : 'text-bear')}>
                {p.unrealizedPct >= 0 ? '+' : ''}{p.unrealizedPct.toFixed(2)}%
              </p>
            </div>
            <button onClick={() => closePosition(p.id)} aria-label={`Cerrar ${p.symbol}`} className="rounded-xl bg-bear/15 p-2 text-bear active:scale-95">
              <X size={15} />
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
