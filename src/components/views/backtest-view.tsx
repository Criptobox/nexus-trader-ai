'use client'

// ─────────────────────────────────────────────────────────────
// Backtesting — configuración, ejecución y resultados
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { Play, Loader2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { CoinIcon } from '@/components/coin-icon'
import { AreaChartSimple } from '@/components/charts/area-chart'
import { useToast } from '@/hooks/use-toast'
import type { BacktestMetrics, EquityPoint, BacktestTrade } from '@/lib/types'
import { cn } from '@/lib/utils'

const STRATEGIES = [
  { id: 'sma_cross', name: 'Cruce SMA', desc: 'Seguidor de tendencia clásico' },
  { id: 'momentum', name: 'Momentum', desc: 'SMA + RSI en confluencia' },
  { id: 'rsi_reversion', name: 'RSI Reversión', desc: 'Compra miedo, vende euforia' },
  { id: 'breakout', name: 'Ruptura', desc: 'Donchian: máximos/mínimos de N velas' },
] as const

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE']
const INTERVALS = ['15m', '1h', '4h', '1d']

interface Result {
  metrics: BacktestMetrics
  equityCurve: EquityPoint[]
  trades: BacktestTrade[]
}

interface HistoryRun {
  id: string
  name: string
  metrics: BacktestMetrics
  createdAt: string
}

export function BacktestView() {
  const [symbol, setSymbol] = useState('BTC')
  const [interval, setIntervalState] = useState('1h')
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]['id']>('sma_cross')
  const [capital, setCapital] = useState('10000')
  const [riskPct, setRiskPct] = useState([1])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<HistoryRun[]>([])
  const { toast } = useToast()

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/backtest').then((r) => r.json())
      if (res.runs) setHistory(res.runs)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const run = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, interval, strategy,
          initialCapital: Number(capital) || 10000,
          riskPerTradePct: riskPct[0],
        }),
      }).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      setResult(res)
      toast({ title: '✅ Backtest completado', description: `${res.metrics.totalTrades} operaciones simuladas` })
      loadHistory()
    } catch (err) {
      toast({ title: 'Error en backtest', description: err instanceof Error ? err.message : 'desconocido', variant: 'destructive' })
    }
    setRunning(false)
  }

  const m = result?.metrics
  const up = (m?.totalReturnPct ?? 0) >= 0

  return (
    <div className="space-y-4">
      <h2 className="px-1 text-lg font-bold">Laboratorio de Backtesting</h2>

      {/* configuración */}
      <section className="glass space-y-3 rounded-3xl p-4">
        <div className="nexus-scroll flex gap-1.5 overflow-x-auto pb-1">
          {SYMBOLS.map((s) => (
            <button key={s} onClick={() => setSymbol(s)}
              className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold',
                symbol === s ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'glass opacity-70')}>
              <CoinIcon symbol={s} size={15} /> {s}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {INTERVALS.map((i) => (
            <button key={i} onClick={() => setIntervalState(i)}
              className={cn('flex-1 rounded-lg py-1.5 text-[11px] font-bold', interval === i ? 'bg-primary/20 text-primary' : 'glass text-muted-foreground')}>
              {i}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {STRATEGIES.map((s) => (
            <button key={s.id} onClick={() => setStrategy(s.id)}
              className={cn('rounded-xl p-2.5 text-left transition-all', strategy === s.id ? 'bg-primary/15 ring-1 ring-primary/40' : 'glass')}>
              <p className="text-[11px] font-bold">{s.name}</p>
              <p className="text-[9px] leading-tight text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Capital inicial (USDT)</label>
            <Input value={capital} onChange={(e) => setCapital(e.target.value.replace(/[^0-9]/g, ''))} className="glass border-0 font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Riesgo por operación: <span className="font-bold text-primary">{riskPct[0]}%</span></label>
            <Slider value={riskPct} onValueChange={setRiskPct} min={0.25} max={3} step={0.25} className="mt-2.5" />
          </div>
        </div>

        <Button onClick={run} disabled={running} className="w-full gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? 'Simulando 500 velas…' : 'Ejecutar backtest'}
        </Button>
      </section>

      {/* resultados */}
      {m && (
        <section className="fade-up space-y-3">
          <div className="glass rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Retorno total</p>
              <p className={cn('font-mono text-2xl font-black', up ? 'text-bull' : 'text-bear')}>
                {up ? '+' : ''}{m.totalReturnPct.toFixed(2)}%
              </p>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              ${m.finalEquity.toLocaleString('en-US')} final · {m.totalTrades} operaciones
            </p>
            {result && result.equityCurve.length > 2 && (
              <div className="mt-3">
                <AreaChartSimple data={result.equityCurve.map((e) => ({ t: String(e.t), equity: e.equity }))} up={up} height={140} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sharpe', value: m.sharpe.toFixed(2), good: m.sharpe > 1 },
              { label: 'Sortino', value: m.sortino.toFixed(2), good: m.sortino > 1.5 },
              { label: 'Max DD', value: `${m.maxDrawdownPct.toFixed(1)}%`, good: m.maxDrawdownPct < 15 },
              { label: 'Win rate', value: `${m.winRate.toFixed(0)}%`, good: m.winRate > 45 },
              { label: 'Profit f.', value: m.profitFactor.toFixed(2), good: m.profitFactor > 1.3 },
              { label: 'CAGR', value: `${m.cagr.toFixed(0)}%`, good: m.cagr > 0 },
            ].map((k) => (
              <div key={k.label} className="glass rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className={cn('mt-0.5 font-mono text-sm font-bold', k.good ? 'text-bull' : 'text-muted-foreground')}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* últimos trades */}
          {result && result.trades.length > 0 && (
            <div className="glass rounded-2xl p-3">
              <p className="mb-2 text-xs font-bold">Últimas operaciones simuladas</p>
              <div className="nexus-scroll max-h-56 space-y-1.5 overflow-y-auto">
                {[...result.trades].reverse().slice(0, 20).map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[11px]">
                    <span className={cn('font-black', t.side === 'long' ? 'text-primary' : 'text-bear')}>
                      {t.side === 'long' ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="font-mono text-muted-foreground">{t.entryPrice.toPrecision(5)} → {t.exitPrice.toPrecision(5)}</span>
                    <span className={cn('font-mono font-bold', t.pnl >= 0 ? 'text-bull' : 'text-bear')}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(1)} ({t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* historial */}
      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 px-1 text-sm font-bold"><History size={14} /> Backtests recientes</h3>
          <div className="nexus-scroll max-h-52 space-y-1.5 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="glass flex items-center justify-between rounded-xl px-3 py-2.5 text-[11px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{h.name}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(h.createdAt).toLocaleString('es')}</p>
                </div>
                <span className={cn('font-mono font-bold', (h.metrics.totalReturnPct ?? 0) >= 0 ? 'text-bull' : 'text-bear')}>
                  {(h.metrics.totalReturnPct ?? 0) >= 0 ? '+' : ''}{(h.metrics.totalReturnPct ?? 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
