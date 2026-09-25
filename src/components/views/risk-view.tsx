'use client'

// ─────────────────────────────────────────────────────────────
// Riesgo & Kill Switch — configuración, métricas y corte
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Loader2, ScrollText, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface RiskData {
  config: {
    maxRiskPerTrade: number
    maxDailyLoss: number
    maxDrawdown: number
    maxOpenPositions: number
    maxPortfolioExposure: number
    atrStopMultiplier: number
    minRewardRisk: number
    consecutiveLossLimit: number
    volatilityGuard: boolean
  }
  exposure: number
  dailyPnlPct: number
  drawdownPct: number
  openPositions: number
  events: { id: string; type: string; severity: string; message: string; createdAt: string }[]
}

export function RiskView() {
  const [data, setData] = useState<RiskData | null>(null)
  const [saving, setSaving] = useState(false)
  const [killing, setKilling] = useState(false)
  const { toast } = useToast()
  const killSwitch = useAppStore((s) => s.killSwitch)
  const setKillSwitch = useAppStore((s) => s.setKillSwitch)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/risk').then((r) => r.json())
      if (!res.error) setData(res)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    const initial = setTimeout(load, 0)
    const t = setInterval(load, 15000)
    return () => { clearTimeout(initial); clearInterval(t) }
  }, [load])

  const updateConfig = async (patch: Record<string, number | boolean>) => {
    setSaving(true)
    try {
      await fetch('/api/risk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      load()
    } catch { /* silencioso */ }
    setSaving(false)
  }

  const setKill = async (activate: boolean) => {
    setKilling(true)
    try {
      const res = await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: activate ? 'activate' : 'deactivate', reason: 'Desde la pantalla de riesgo' }),
      }).then((r) => r.json())
      setKillSwitch(res)
      toast({
        title: activate ? '🚨 KILL SWITCH ACTIVADO' : '✅ Trading reactivado',
        description: activate ? 'Todas las posiciones paper cerradas. Sistema congelado.' : 'El Risk Engine vuelve a operar.',
        variant: activate ? 'destructive' : 'default',
      })
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    }
    setKilling(false)
  }

  const cfg = data?.config
  const metrics = [
    { label: 'Exposición', value: `${(data?.exposure ?? 0).toFixed(1)}%`, limit: cfg?.maxPortfolioExposure, danger: (data?.exposure ?? 0) > (cfg?.maxPortfolioExposure ?? 100) },
    { label: 'PnL diario', value: `${(data?.dailyPnlPct ?? 0).toFixed(2)}%`, limit: -(cfg?.maxDailyLoss ?? 0), danger: (data?.dailyPnlPct ?? 0) <= -(cfg?.maxDailyLoss ?? 100) },
    { label: 'Drawdown', value: `${(data?.drawdownPct ?? 0).toFixed(1)}%`, limit: cfg?.maxDrawdown, danger: (data?.drawdownPct ?? 0) >= (cfg?.maxDrawdown ?? 100) },
    { label: 'Posiciones', value: String(data?.openPositions ?? 0), limit: cfg?.maxOpenPositions, danger: (data?.openPositions ?? 0) >= (cfg?.maxOpenPositions ?? 99) },
  ]

  return (
    <div className="space-y-4">
      <h2 className="px-1 text-lg font-bold">Riesgo & Kill Switch</h2>

      {/* estado kill switch */}
      <section
        className={cn(
          'relative overflow-hidden rounded-3xl p-5 text-center',
          killSwitch?.active ? 'bg-bear/15 ring-1 ring-bear/40' : 'glass',
        )}
      >
        <div className="flex items-center justify-center gap-2">
          {killSwitch?.active ? <ShieldAlert size={22} className="text-bear" /> : <ShieldCheck size={22} className="text-primary" />}
          <p className={cn('text-base font-black', killSwitch?.active ? 'text-bear' : 'text-primary')}>
            {killSwitch?.active ? 'TRADING DETENIDO' : 'PROTECCIÓN ACTIVA'}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {killSwitch?.active
            ? killSwitch.reason ?? 'Corte de emergencia en curso'
            : 'El Risk Engine valida cada orden antes de ejecutarse'}
        </p>

        {killSwitch?.active ? (
          <Button
            onClick={() => setKill(false)} disabled={killing}
            className="mt-4 w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground"
          >
            {killing ? <Loader2 size={16} className="animate-spin" /> : 'Reactivar trading'}
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4 w-full rounded-2xl bg-bear py-4 text-base font-black text-white">
                🚨 KILL SWITCH
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-strong max-w-sm rounded-3xl border-0">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Activar el Kill Switch?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se detiene toda la operativa paper, se cierran todas las posiciones abiertas y el sistema queda congelado hasta que lo reactives manualmente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => setKill(true)} className="rounded-xl bg-bear text-white">
                  Sí, detener todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </section>

      {/* métricas en vivo */}
      <section className="grid grid-cols-4 gap-2">
        {metrics.map((k) => (
          <div key={k.label} className={cn('glass rounded-xl p-2.5 text-center', k.danger && 'ring-1 ring-bear/50')}>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className={cn('mt-0.5 font-mono text-sm font-bold', k.danger ? 'text-bear' : '')}>{k.value}</p>
            {k.limit !== undefined && <p className="text-[8px] text-muted-foreground">límite {k.limit}</p>}
          </div>
        ))}
      </section>

      {/* configuración */}
      <section className="glass space-y-4 rounded-3xl p-4">
        <p className="text-sm font-bold">Límites del Risk Engine</p>
        {saving && <p className="text-[10px] text-primary">Guardando…</p>}
        {!cfg ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            {[
              { key: 'maxRiskPerTrade', label: 'Riesgo por operación', value: cfg.maxRiskPerTrade, min: 0.25, max: 3, step: 0.25, unit: '%' },
              { key: 'maxDailyLoss', label: 'Pérdida diaria máxima (soft stop)', value: cfg.maxDailyLoss, min: 1, max: 10, step: 0.5, unit: '%' },
              { key: 'maxDrawdown', label: 'Drawdown máximo (full stop)', value: cfg.maxDrawdown, min: 5, max: 30, step: 1, unit: '%' },
              { key: 'maxPortfolioExposure', label: 'Exposición máxima del portafolio', value: cfg.maxPortfolioExposure, min: 20, max: 100, step: 5, unit: '%' },
              { key: 'minRewardRisk', label: 'R:R mínimo exigido', value: cfg.minRewardRisk, min: 1, max: 4, step: 0.1, unit: '' },
              { key: 'atrStopMultiplier', label: 'Stop = ATR ×', value: cfg.atrStopMultiplier, min: 1, max: 4, step: 0.5, unit: '' },
              { key: 'consecutiveLossLimit', label: 'Pérdidas consecutivas → pausa', value: cfg.consecutiveLossLimit, min: 2, max: 6, step: 1, unit: '' },
            ].map((s) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">{s.label}</label>
                  <span className="font-mono text-xs font-bold text-primary">{s.value}{s.unit}</span>
                </div>
                <Slider
                  value={[s.value]}
                  min={s.min} max={s.max} step={s.step}
                  onValueCommit={(v) => updateConfig({ [s.key]: v[0] })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <div>
                <p className="text-[11px] font-semibold">Guardia de volatilidad</p>
                <p className="text-[10px] text-muted-foreground">Bloquea entradas si el ATR supera 6% por vela</p>
              </div>
              <Switch
                checked={cfg.volatilityGuard}
                onCheckedChange={(v) => updateConfig({ volatilityGuard: v })}
              />
            </div>
          </>
        )}
      </section>

      {/* log de eventos */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 px-1 text-sm font-bold"><ScrollText size={14} /> Log de eventos de riesgo</h3>
        <div className="nexus-scroll max-h-64 space-y-1.5 overflow-y-auto">
          {!data?.events.length ? (
            <div className="glass rounded-2xl p-5 text-center text-xs text-muted-foreground">Sin eventos registrados aún.</div>
          ) : data.events.map((e) => (
            <div key={e.id} className="glass flex gap-2.5 rounded-xl px-3 py-2.5">
              <span className={cn('mt-0.5',
                e.severity === 'critical' ? 'text-bear' : e.severity === 'warning' ? 'text-gold' : 'text-primary')}>
                {e.severity === 'critical' ? <AlertTriangle size={13} /> : <span className="inline-block h-2 w-2 rounded-full bg-current" />}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] leading-snug">{e.message}</p>
                <p className="text-[9px] text-muted-foreground">{new Date(e.createdAt).toLocaleString('es')} · {e.type}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
