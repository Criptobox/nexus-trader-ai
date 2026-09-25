'use client'

// ─────────────────────────────────────────────────────────────
// App Shell — header premium + navegación inferior móvil + views
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import {
  LayoutDashboard, LineChart, Bot, Wallet, LayoutGrid,
  FlaskConical, ShieldAlert, BookOpen, Settings,
} from 'lucide-react'
import { useAppStore, type ViewId } from '@/lib/store'
import { NexusAvatar } from '@/components/agents/nexus-avatar'
import { DashboardView } from '@/components/views/dashboard-view'
import { MarketsView } from '@/components/views/markets-view'
import { AgentView } from '@/components/views/agent-view'
import { PortfolioView } from '@/components/views/portfolio-view'
import { BacktestView } from '@/components/views/backtest-view'
import { RiskView } from '@/components/views/risk-view'
import { KnowledgeView } from '@/components/views/knowledge-view'
import { SettingsView } from '@/components/views/settings-view'
import { cn } from '@/lib/utils'

const NAV: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'markets', label: 'Mercados', icon: LineChart },
  { id: 'agent', label: 'Agente', icon: Bot },
  { id: 'portfolio', label: 'Portafolio', icon: Wallet },
  { id: 'more', label: 'Más', icon: LayoutGrid },
]

const MORE_VIEWS: { id: ViewId; label: string; desc: string; icon: typeof LayoutDashboard; color: string }[] = [
  { id: 'backtest', label: 'Backtesting', desc: 'Valida estrategias con datos históricos', icon: FlaskConical, color: '#38BDF8' },
  { id: 'risk', label: 'Riesgo & Kill Switch', desc: 'Límites automáticos y corte de emergencia', icon: ShieldAlert, color: '#EF4444' },
  { id: 'knowledge', label: 'Conocimiento', desc: 'Artículos, glosario y memoria del agente', icon: BookOpen, color: '#F472B6' },
  { id: 'settings', label: 'Ajustes', desc: 'Vault de claves, router de modelos, exchange', icon: Settings, color: '#A78BFA' },
]

export function AppShell() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const killSwitch = useAppStore((s) => s.killSwitch)

  // estado del kill switch global (poll ligero)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/kill-switch')
        .then((r) => r.json())
        .then((k) => { if (alive && k && 'active' in k) useAppStore.getState().setKillSwitch(k) })
        .catch(() => null)
    load()
    const t = setInterval(load, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const showMoreGrid = view === 'more'
  const activeNav = NAV.some((n) => n.id === view) ? view : 'more'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-2xl lg:max-w-4xl">
      {/* ── Header ── */}
      <header className="glass-strong safe-top sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3">
        <button className="flex items-center gap-2.5" onClick={() => setView('dashboard')} aria-label="Ir al inicio">
          <NexusAvatar size={40} />
          <div className="text-left">
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
              NEXUS <span className="text-[10px] font-semibold text-primary">TRADER AI</span>
              <span className="rounded-full bg-primary/15 px-1.5 py-px text-[8px] font-bold text-primary">v2.0.0</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {killSwitch?.active ? (
                <span className="font-semibold text-bear">🚨 Kill Switch activo</span>
              ) : (
                'Comité multiagente · modo paper'
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {killSwitch?.active && (
            <span className="pulse-danger rounded-full bg-bear/15 px-2.5 py-1 text-[10px] font-bold text-bear">
              TRADING DETENIDO
            </span>
          )}
        </div>
      </header>

      {/* ── Views ── */}
      <main className="flex-1 px-4 pb-28 pt-3">
        <div key={view} className="fade-up">
          {view === 'dashboard' && <DashboardView />}
          {view === 'markets' && <MarketsView />}
          {view === 'agent' && <AgentView />}
          {view === 'portfolio' && <PortfolioView />}
          {view === 'backtest' && <BacktestView />}
          {view === 'risk' && <RiskView />}
          {view === 'knowledge' && <KnowledgeView />}
          {view === 'settings' && <SettingsView />}
          {showMoreGrid && (
            <div className="space-y-3">
              <h2 className="px-1 text-lg font-bold">Más herramientas</h2>
              <div className="grid grid-cols-2 gap-3">
                {MORE_VIEWS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setView(m.id)}
                    className="glass group flex flex-col gap-2 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${m.color}1E`, color: m.color }}
                    >
                      <m.icon size={20} />
                    </span>
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom nav ── */}
      <nav
        aria-label="Navegación principal"
        className="glass-strong safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end justify-around px-2 pb-2 pt-1.5 md:max-w-2xl lg:max-w-4xl"
      >
        {NAV.map((n) => {
          const active = activeNav === n.id
          if (n.id === 'agent') {
            return (
              <button
                key={n.id}
                onClick={() => setView('agent')}
                aria-label="Agente conversacional"
                className={cn('relative -mt-6 flex flex-col items-center gap-0.5')}
              >
                <span
                  className={cn(
                    'glow-agent flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-[#0B0F17] transition-transform active:scale-95',
                    active && 'scale-105',
                  )}
                >
                  <NexusAvatar size={48} />
                </span>
                <span className={cn('text-[10px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}>
                  Agente
                </span>
              </button>
            )
          }
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              aria-label={n.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <n.icon size={21} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{n.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
