'use client'

// ─────────────────────────────────────────────────────────────
// Wrapper del avatar 3D — carga diferida solo en el cliente
// (WebGL no existe en SSR). Mientras carga muestra el avatar
// 2D animado como fallback progresivo.
// ─────────────────────────────────────────────────────────────
import dynamic from 'next/dynamic'
import { NexusAvatar, type NexusState } from './nexus-avatar'

export type Nexus3DState = NexusState | 'happy' | 'alert' | 'trading'

const NexusScene = dynamic(
  () => import('./nexus-3d-scene').then((m) => m.NexusScene3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <NexusAvatar size={96} state="idle" />
      </div>
    ),
  },
)

interface NexusAvatar3DProps {
  state?: Nexus3DState
  interactive?: boolean
  className?: string
  height?: number | string
}

export function NexusAvatar3D({
  state = 'idle',
  interactive = true,
  className,
  height = 260,
}: NexusAvatar3DProps) {
  return (
    <div
      className={className}
      style={{ height, width: '100%' }}
      role="img"
      aria-label={`NEXUS avatar 3D interactivo — estado ${state}`}
    >
      <NexusScene state={state} interactive={interactive} />
    </div>
  )
}
