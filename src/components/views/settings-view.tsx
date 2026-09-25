'use client'

// ─────────────────────────────────────────────────────────────
// Ajustes — vault de API keys, router de modelos, exchange
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2, ShieldCheck, Cpu, Building2, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { RouterProfile } from '@/lib/types'
import { cn } from '@/lib/utils'

interface VaultKeyEntry {
  id: string
  label: string
  exchange: string
  scope: string
  masked: string
  active: boolean
}

interface ExchangeInfo {
  exchanges: { id: string; name: string; connected: boolean; keysConfigured: number; scope: string; tradingEnabled: boolean; note: string }[]
  executionMode: string
  roadmapPhase: string
}

export function SettingsView() {
  const [keys, setKeys] = useState<VaultKeyEntry[]>([])
  const [profiles, setProfiles] = useState<RouterProfile[]>([])
  const [exchange, setExchange] = useState<ExchangeInfo | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const { toast } = useToast()

  // formulario de nueva clave
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [scope, setScope] = useState('read')
  const [exchangeId, setExchangeId] = useState('binance')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings').then((r) => r.json())
      if (res.keys) setKeys(res.keys)
      if (res.routerProfiles) setProfiles(res.routerProfiles)
      if (res.exchanges) setExchange(res.exchanges)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const addKey = async () => {
    if (!secret || secret.length < 16) {
      toast({ title: 'Clave demasiado corta', description: 'Mínimo 16 caracteres.', variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addKey', label: label || 'Mi clave', exchange: exchangeId, scope, secret }),
      }).then((r) => r.json())
      if (res.ok) {
        toast({ title: '🔐 Clave cifrada y guardada', description: 'AES-256-GCM · nunca sale del servidor' })
        setSecret(''); setLabel('')
        load()
      } else {
        toast({ title: 'Rechazado', description: res.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
    setAdding(false)
  }

  const deleteKey = async (id: string) => {
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteKey', id }),
    })
    load()
  }

  const toggleProfile = async (id: string) => {
    const updated = profiles.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    setProfiles(updated)
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveProfiles', profiles: updated }),
    })
  }

  const testAccount = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testAccount' }),
      }).then((r) => r.json())
      setTestResult(res.ok
        ? { ok: true, message: `Conexión OK — ${res.balances?.length ?? 0} activos con balance` }
        : { ok: false, message: res.error ?? 'No se pudo conectar' })
    } catch {
      setTestResult({ ok: false, message: 'Error de red' })
    }
    setTesting(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="px-1 text-lg font-bold">Ajustes</h2>

      {/* ── Vault de claves ── */}
      <section className="glass space-y-3 rounded-3xl p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <KeyRound size={15} className="text-primary" /> Vault de claves API
        </p>
        <div className="flex items-start gap-2 rounded-xl bg-primary/10 p-3">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-[10px] leading-relaxed text-primary">
            Cifrado AES-256-GCM en servidor · nunca se devuelven completas al cliente · claves de retiro
            prohibidas por política. Crea claves de <b>solo lectura</b> en tu exchange con restricción de IP.
          </p>
        </div>

        {keys.length > 0 && (
          <div className="space-y-1.5">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5">
                <Building2 size={15} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{k.label} <span className="font-normal text-muted-foreground">· {k.exchange}</span></p>
                  <p className="font-mono text-[10px] text-muted-foreground">{k.masked}</p>
                </div>
                <Badge variant={k.scope === 'trade' ? 'default' : 'secondary'} className="rounded-full text-[9px]">{k.scope}</Badge>
                <button onClick={() => deleteKey(k.id)} aria-label="Eliminar clave" className="rounded-lg p-1.5 text-muted-foreground active:scale-95">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta (Binance main)" className="glass border-0 text-xs" />
            <Select value={exchangeId} onValueChange={setExchangeId}>
              <SelectTrigger className="glass border-0 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="bybit">Bybit</SelectItem>
                <SelectItem value="okx">OKX</SelectItem>
                <SelectItem value="coinbase">Coinbase</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="API secret (se cifra al instante)"
            type="password"
            className="glass border-0 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="glass w-full border-0 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Solo lectura (recomendado)</SelectItem>
                  <SelectItem value="trade">Trading (paper→real en Fase 4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addKey} disabled={adding} className="shrink-0 gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Cifrar y guardar
            </Button>
          </div>
        </div>
      </section>

      {/* ── Router de modelos ── */}
      <section className="glass space-y-3 rounded-3xl p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Cpu size={15} className="text-gold" /> Router multi-modelo
        </p>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Cada tarea se enruta al modelo óptimo con cadena de fallback automática. Si un modelo falla, el
          siguiente intenta la respuesta.
        </p>
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">{p.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {p.provider === 'zai' ? `Z.ai · ${p.model ?? 'modelo por defecto'}` : p.provider} · {p.useFor.join(', ')}
              </p>
            </div>
            <Switch checked={p.enabled} onCheckedChange={() => toggleProfile(p.id)} />
          </div>
        ))}
      </section>

      {/* ── Exchange ── */}
      <section className="glass space-y-3 rounded-3xl p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Building2 size={15} className="text-primary" /> Integración con exchanges
        </p>
        {exchange?.exchanges.map((e) => (
          <div key={e.id} className="rounded-xl bg-surface px-3 py-2.5">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-bold">{e.name}</p>
              {e.connected
                ? <span className="flex items-center gap-1 text-[10px] font-bold text-primary"><CheckCircle2 size={11} /> Conectado</span>
                : <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><XCircle size={11} /> No configurado</span>}
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{e.note}</p>
          </div>
        ))}
        <Button onClick={testAccount} disabled={testing} variant="secondary" className="w-full gap-2 rounded-xl py-2.5 text-xs font-bold">
          {testing ? <Loader2 size={13} className="animate-spin" /> : null}
          Probar lectura de cuenta real
        </Button>
        {testResult && (
          <p className={cn('rounded-xl px-3 py-2 text-[10px] font-medium',
            testResult.ok ? 'bg-primary/10 text-primary' : 'bg-gold/10 text-gold')}>
            {testResult.ok ? '✅' : '⚠️'} {testResult.message}
          </p>
        )}
        <p className="text-center text-[9px] text-muted-foreground">
          Modo de ejecución: <b>paper only</b> — la ejecución con dinero real se habilita en la Fase 4 del roadmap.
        </p>
      </section>
    </div>
  )
}
