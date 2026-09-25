'use client'

// ─────────────────────────────────────────────────────────────
// NEXUS Avatar — rostro del agente con estados animados:
// · idle      → respiración suave + anillo orbital lento
// · listening → anillos sónicos expandiéndose (te está oyendo)
// · thinking  → partículas orbitando + giro rápido (procesando)
// · speaking  → ecualizador de voz + resplandor pulsante
// ─────────────────────────────────────────────────────────────
import { cn } from '@/lib/utils'

export type NexusState = 'idle' | 'listening' | 'thinking' | 'speaking'

const STATE_COLOR: Record<NexusState, string> = {
  idle: '#10B981',
  listening: '#F59E0B',
  thinking: '#38BDF8',
  speaking: '#10B981',
}

interface NexusAvatarProps {
  size?: number
  state?: NexusState
  className?: string
}

export function NexusAvatar({ size = 120, state = 'idle', className }: NexusAvatarProps) {
  const color = STATE_COLOR[state]
  const active = state !== 'idle'

  return (
    <div
      className={cn('relative shrink-0 select-none', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`NEXUS — estado ${state}`}
    >
      {/* resplandor ambiental */}
      <div
        className="absolute -inset-[14%] rounded-full blur-2xl transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${color}4D, transparent 70%)`,
          opacity: active ? 1 : 0.55,
          animation: state === 'speaking' ? 'nexus-glow-pulse 1.1s ease-in-out infinite' : undefined,
        }}
      />

      {/* anillos sónicos — escuchando */}
      {state === 'listening' && (
        <>
          <span
            className="absolute inset-[-4%] rounded-full border-2 nexus-sonar"
            style={{ borderColor: color }}
          />
          <span
            className="absolute inset-[-4%] rounded-full border-2 nexus-sonar nexus-sonar-delay"
            style={{ borderColor: color }}
          />
        </>
      )}

      {/* anillo orbital exterior */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r="48.6" fill="none" stroke={`${color}26`} strokeWidth="1.4" />
        <circle
          cx="50" cy="50" r="48.6" fill="none"
          stroke={color} strokeWidth="2.4" strokeLinecap="round"
          strokeDasharray="34 271"
          className={cn(state === 'thinking' ? 'nexus-spin-fast' : 'nexus-spin-slow')}
          style={{ opacity: active ? 0.95 : 0.55, transformOrigin: '50% 50%' }}
        />
      </svg>

      {/* rostro del agente */}
      { }
      <img
        src="/img/nexus-avatar.png"
        alt="NEXUS — agente de inteligencia artificial"
        draggable={false}
        className="absolute inset-[7%] h-[86%] w-[86%] rounded-full object-cover"
        style={{
          boxShadow: `0 0 0 1.5px ${color}59, 0 10px 32px ${color}40`,
          animation:
            state === 'idle'
              ? 'nexus-breathe 5.2s ease-in-out infinite'
              : state === 'thinking'
                ? 'nexus-breathe 1.8s ease-in-out infinite'
                : undefined,
          transition: 'box-shadow .6s ease',
        }}
      />

      {/* partículas orbitando — pensando */}
      {state === 'thinking' && (
        <div className="nexus-orbit absolute inset-[2%]">
          <span className="nexus-orbit-dot" style={{ background: color, top: 0, left: '50%' }} />
          <span className="nexus-orbit-dot" style={{ background: '#38BDF8', bottom: '8%', left: '12%' }} />
          <span className="nexus-orbit-dot" style={{ background: '#A78BFA', bottom: '8%', right: '12%' }} />
        </div>
      )}

      {/* ecualizador — hablando */}
      {state === 'speaking' && (
        <div className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-end gap-[3px] rounded-full bg-[#0B0F17]/70 px-2 py-1.5 backdrop-blur-sm">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="nexus-eq-bar"
              style={{
                background: color,
                animationDelay: `${i * 0.13}s`,
                animationDuration: `${0.55 + (i % 3) * 0.12}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
