'use client'

// ─────────────────────────────────────────────────────────────
// Avatar de agente especialista — gradiente + icono + anillo
// ─────────────────────────────────────────────────────────────
import {
  BrainCircuit, CandlestickChart, Radar, ShieldCheck, Swords, GraduationCap, type LucideIcon,
} from 'lucide-react'
import type { AgentId, AgentProfile } from '@/lib/types'
import { AGENT_PROFILES } from '@/lib/agents/base-agent'

const ICONS: Record<string, LucideIcon> = {
  'brain-circuit': BrainCircuit,
  'candlestick-chart': CandlestickChart,
  radar: Radar,
  'shield-check': ShieldCheck,
  swords: Swords,
  'graduation-cap': GraduationCap,
}

interface AgentAvatarProps {
  agentId: AgentId | AgentProfile
  size?: number
  pulsing?: boolean
  className?: string
}

export function AgentAvatar({ agentId, size = 44, pulsing, className }: AgentAvatarProps) {
  const profile = typeof agentId === 'string' ? AGENT_PROFILES[agentId as AgentId] : agentId
  if (!profile) return null
  const Icon = ICONS[profile.icon] ?? BrainCircuit
  const [from, to] = profile.gradient

  return (
    <div
      className={`relative rounded-2xl flex items-center justify-center text-white shadow-lg ${pulsing ? 'animate-pulse' : ''} ${className ?? ''}`}
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: `0 4px 20px ${to}55`,
      }}
      aria-label={`${profile.name} — ${profile.role}`}
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
      <span
        className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#0B0F17]"
        style={{ width: size * 0.28, height: size * 0.28, background: profile.color }}
      />
    </div>
  )
}

export { AGENT_PROFILES }
