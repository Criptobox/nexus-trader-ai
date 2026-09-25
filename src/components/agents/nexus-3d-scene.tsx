'use client'

// ─────────────────────────────────────────────────────────────
// NEXUS 3D — avatar interactivo en tiempo real (Three.js/R3F)
// Un compañero vivo, no una imagen:
// · Sigue tu cursor/dedo con la mirada y la cabeza
// · Parpadea, respira, flota y reacciona a los taps
// · Estados con animación y color propios:
//   idle · listening · thinking · speaking · happy · alert
// · Anillos giroscópicos, partículas orbitales, núcleo de voz
// · Bloom cinematográfico + iluminación de estado
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

export type Nexus3DState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'alert'

const STATE_COLOR: Record<Nexus3DState, string> = {
  idle: '#10B981',
  listening: '#F59E0B',
  thinking: '#38BDF8',
  speaking: '#34D399',
  happy: '#FBBF24',
  alert: '#EF4444',
}

const STATE_TUNING: Record<Nexus3DState, { ring: number; orbit: number; breath: number }> = {
  idle: { ring: 0.35, orbit: 0.4, breath: 1.9 },
  listening: { ring: 1.1, orbit: 1.0, breath: 2.6 },
  thinking: { ring: 2.6, orbit: 2.4, breath: 3.4 },
  speaking: { ring: 0.7, orbit: 0.9, breath: 2.2 },
  happy: { ring: 1.6, orbit: 1.8, breath: 3.0 },
  alert: { ring: 1.4, orbit: 1.4, breath: 4.2 },
}

// gradiente radial para el halo del suelo (textura procedural local)
function makeGlowTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface SceneProps {
  state: Nexus3DState
  interactive?: boolean
}

function NexusModel({ state, interactive = true }: SceneProps) {
  const { pointer } = useThree()

  // refs de grupos y materiales que se animan cada frame
  const root = useRef<THREE.Group>(null)        // flotación + parallax global
  const head = useRef<THREE.Group>(null)        // giro hacia el puntero
  const eyes = useRef<THREE.Group>(null)        // micro-movimiento de ojos
  const eyeL = useRef<THREE.Mesh>(null)
  const eyeR = useRef<THREE.Mesh>(null)
  const arcs = useRef<THREE.Group>(null)        // ojos felices (arcos ^^)
  const mouth = useRef<THREE.Mesh>(null)
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const bead1 = useRef<THREE.Mesh>(null)
  const bead2 = useRef<THREE.Mesh>(null)
  const particles = useRef<THREE.Points>(null)
  const gem = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const rimL = useRef<THREE.PointLight>(null)
  const rimR = useRef<THREE.PointLight>(null)

  // estado animado persistente
  const anim = useRef({
    color: new THREE.Color(STATE_COLOR.idle),
    blinkAt: 2.4,
    blinkPhase: -1,             // <0 = sin parpadeo
    wander: new THREE.Vector2(0, 0),
    wanderAt: 0,
    lastPointerMove: 0,
    reactionStart: -99,         // tap del usuario
    ringAngle: 0,
    orbitAngle: 0,
  })

  const glowTex = useMemo(() => makeGlowTexture(), [])

  // posiciones de partículas orbitales (elipses inclinadas aleatorias fijas)
  const particleData = useMemo(() => {
    const n = 30
    const arr = new Float32Array(n * 3)
    const meta: { r: number; tilt: number; phase: number; speed: number; y0: number }[] = []
    for (let i = 0; i < n; i++) {
      meta.push({
        r: 1.55 + Math.random() * 0.65,
        tilt: (Math.random() - 0.5) * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.9,
        y0: (Math.random() - 0.5) * 0.7,
      })
    }
    return { arr, meta }
  }, [])

  // rastrear el puntero sobre TODA la ventana (no solo el canvas)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
      anim.current.lastPointerMove = performance.now() / 1000
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [pointer])

  // tap → reacción (giro celebratorio + ojos felices)
  const onTap = () => {
    if (!interactive) return
    anim.current.reactionStart = performance.now() / 1000
  }

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = st.clock.elapsedTime
    const a = anim.current
    const tune = STATE_TUNING[state]

    // ── color de estado (lerp suave) ──
    a.color.lerp(new THREE.Color(STATE_COLOR[state]), 1 - Math.exp(-dt * 4.5))
    const C = a.color

    // ── flotación + respiración + parallax ──
    const breathe = 1 + 0.018 * Math.sin(t * tune.breath)
    if (root.current) {
      root.current.position.y = 0.12 + Math.sin(t * 1.15) * 0.09
      root.current.scale.setScalar(breathe)
      // parallax global sutil con el puntero
      root.current.rotation.y += (pointer.x * 0.12 - root.current.rotation.y) * (1 - Math.exp(-dt * 2))
      // reacción al tap: giro con decaimiento + "boing"
      const sinceTap = t - a.reactionStart
      if (sinceTap < 1.25) {
        const k = Math.exp(-sinceTap * 3.2)
        root.current.rotation.y += k * dt * 14
        root.current.position.y += Math.abs(Math.sin(sinceTap * 9)) * 0.16 * k
      }
    }

    // ── cabeza sigue al puntero (o deambula si estás quieto) ──
    const idleFor = t - a.lastPointerMove > 3.5
    if (idleFor && t > a.wanderAt) {
      // nuevo objetivo de mirada aleatorio (vida propia)
      a.wander.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.35) * 0.6)
      a.wanderAt = t + 2 + Math.random() * 2.5
    }
    const lookX = idleFor ? a.wander.x : pointer.x
    const lookY = idleFor ? a.wander.y : pointer.y

    if (head.current) {
      const targetY = THREE.MathUtils.clamp(lookX * 0.5, -0.55, 0.55)
      const targetX = THREE.MathUtils.clamp(-lookY * 0.3, -0.35, 0.3)
        + (state === 'listening' ? -0.1 : 0)          // se inclina cuando escucha
      head.current.rotation.y += (targetY - head.current.rotation.y) * (1 - Math.exp(-dt * 3.5))
      head.current.rotation.x += (targetX - head.current.rotation.x) * (1 - Math.exp(-dt * 3.5))
      // bob rítmico al hablar
      if (state === 'speaking') head.current.position.y = Math.sin(t * 9.5) * 0.022
      else head.current.position.y = 0
    }

    // ── parpadeo (no durante happy/alerta: ojos fijos expresivos) ──
    if (a.blinkPhase < 0 && t > a.blinkAt && state !== 'happy' && state !== 'alert') {
      a.blinkPhase = 0
      a.blinkAt = t + 2.6 + Math.random() * 3.2
    }
    let blinkScale = 1
    if (a.blinkPhase >= 0) {
      a.blinkPhase += dt
      const p = a.blinkPhase / 0.22
      if (p >= 1) a.blinkPhase = -1
      else blinkScale = 1 - Math.sin(p * Math.PI) * 0.92
    }

    // ── ojos: forma por emoción + seguimiento ──
    const eyeScaleYByState: Record<Nexus3DState, number> = {
      idle: 1, listening: 1.22, thinking: 0.52, speaking: 1, happy: 0.26, alert: 1.3,
    }
    const eyeScaleByState: Record<Nexus3DState, number> = {
      idle: 1, listening: 1.12, thinking: 0.94, speaking: 1, happy: 0.9, alert: 1.28,
    }
    const ex = THREE.MathUtils.clamp(lookX * 0.085, -0.14, 0.14)
    const ey = THREE.MathUtils.clamp(lookY * 0.06 + (state === 'thinking' ? 0.05 : 0), -0.1, 0.12)
    if (eyes.current) eyes.current.position.set(ex, ey, 0)

    const pulse = state === 'alert' ? 1 + 0.12 * Math.sin(t * 12) : state === 'speaking' ? 1 + 0.06 * Math.sin(t * 8) : 1
    for (const e of [eyeL.current, eyeR.current]) {
      if (!e) continue
      e.scale.set(
        eyeScaleByState[state] * pulse,
        eyeScaleYByState[state] * blinkScale * pulse,
        1,
      )
      const m = e.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
      m.emissiveIntensity = state === 'alert' ? 4.2 : state === 'thinking' ? 2.6 : 2.2
    }
    // arcos felices ^^ aparecen en happy (y brevemente tras tap)
    const sinceTap2 = t - a.reactionStart
    const happyMix = state === 'happy' ? 1 : sinceTap2 < 1 ? Math.max(0, 1 - sinceTap2) : 0
    if (arcs.current) {
      arcs.current.visible = happyMix > 0.05
      arcs.current.children.forEach((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial
        m.emissive.copy(C)
        m.emissiveIntensity = 3 * happyMix
        m.opacity = happyMix
        m.transparent = true
      })
      if (eyeL.current && eyeR.current) {
        const hide = happyMix * 0.85
        eyeL.current.scale.y *= 1 - hide * 0.9
        eyeR.current.scale.y *= 1 - hide * 0.9
        arcs.current.position.y = 0.02 + (1 - happyMix) * -0.06
      }
    }

    // ── boca = ecualizador de voz ──
    if (mouth.current) {
      const m = mouth.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
      if (state === 'speaking') {
        const amp =
          0.42 + 0.3 * Math.sin(t * 8.1) * Math.abs(Math.sin(t * 2.9 + 0.7)) + 0.18 * Math.sin(t * 13.7 + 1.2)
        const clamped = THREE.MathUtils.clamp(amp, 0.08, 1)
        mouth.current.scale.set(0.45 + clamped * 0.95, 1 + clamped * 0.5, 1)
        m.emissiveIntensity = 1.6 + clamped * 1.8
      } else if (state === 'happy') {
        mouth.current.scale.set(0.85, 0.8, 1)
        m.emissiveIntensity = 2.4
      } else if (state === 'listening') {
        mouth.current.scale.set(0.7, 1.15, 1)
        m.emissiveIntensity = 1.4
      } else {
        mouth.current.scale.set(0.55 + 0.06 * Math.sin(t * 2.2), 0.8, 1)
        m.emissiveIntensity = 0.9
      }
    }

    // ── anillos giroscópicos ──
    a.ringAngle += dt * tune.ring
    if (ring1.current) ring1.current.rotation.z = a.ringAngle
    if (ring2.current) ring2.current.rotation.z = -a.ringAngle * 0.72
    if (ring3.current) {
      ring3.current.rotation.z = a.ringAngle * 0.4
      ring3.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.12 + (state === 'alert' ? 0.25 : 0)
    }
    // cuentas luminosas que recorren los anillos
    if (bead1.current) {
      const th = a.ringAngle * 1.4
      bead1.current.position.set(Math.cos(th) * 1.34, Math.sin(th) * 1.34, 0)
      const m = bead1.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
    }
    if (bead2.current) {
      const th = -a.ringAngle * 0.95 + 2.1
      bead2.current.position.set(Math.cos(th) * 1.52, Math.sin(th) * 1.52, 0)
      const m = bead2.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
    }
    for (const r of [ring1, ring2, ring3]) {
      const mesh = r.current
      if (!mesh) continue
      const m = mesh.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
      m.emissiveIntensity = 0.5 + tune.ring * 0.22
    }

    // ── partículas orbitales ──
    a.orbitAngle += dt * tune.orbit
    if (particles.current) {
      const pos = particles.current.geometry.attributes.position as THREE.BufferAttribute
      const { meta } = particleData
      for (let i = 0; i < meta.length; i++) {
        const p = meta[i]
        const th = a.orbitAngle * p.speed + p.phase
        pos.setXYZ(
          i,
          Math.cos(th) * p.r,
          p.y0 + Math.sin(th * 1.7 + p.phase) * 0.22,
          Math.sin(th) * p.r * 0.9,
        )
      }
      pos.needsUpdate = true
      const m = particles.current.material as THREE.PointsMaterial
      m.color.copy(C)
      m.opacity = state === 'thinking' ? 0.95 : 0.6
    }

    // ── gema, halo y luces de ánimo ──
    if (gem.current) {
      const m = gem.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(C)
      m.emissiveIntensity = 2.4 + Math.sin(t * 3.1) * 0.7
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial
      m.color.copy(C)
      m.opacity = 0.32 + 0.1 * Math.sin(t * 2.3) + (state === 'alert' ? 0.18 : 0)
    }
    if (rimL.current) rimL.current.color.copy(C)
    if (rimR.current) rimR.current.color.lerp(new THREE.Color(STATE_COLOR[state]), 1 - Math.exp(-dt * 4))
  })

  return (
    <group
      ref={root}
      onClick={onTap}
      onPointerDown={onTap}
      data-testid="nexus-3d-root"
    >
      {/* ── cabeza: orbe de cromo oscuro ── */}
      <group ref={head}>
        <mesh scale={[1, 1.06, 0.98]} castShadow>
          <sphereGeometry args={[1, 48, 48]} />
          <meshPhysicalMaterial
            color="#0d1524" metalness={0.92} roughness={0.24}
            clearcoat={1} clearcoatRoughness={0.18} envMapIntensity={1.35}
          />
        </mesh>

        {/* placa facial de cristal oscuro */}
        <mesh position={[0, 0.04, 0.46]} scale={[0.78, 0.6, 0.52]}>
          <sphereGeometry args={[0.86, 40, 40]} />
          <meshPhysicalMaterial
            color="#04070d" metalness={0.55} roughness={0.28}
            clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={0.9}
          />
        </mesh>

        {/* ojos */}
        <group ref={eyes} position={[0, 0, 0]}>
          <mesh ref={eyeL} position={[-0.27, 0.1, 0.86]}>
            <capsuleGeometry args={[0.085, 0.1, 6, 16]} />
            <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
          <mesh ref={eyeR} position={[0.27, 0.1, 0.86]}>
            <capsuleGeometry args={[0.085, 0.1, 6, 16]} />
            <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>

          {/* arcos felices ^^ */}
          <group ref={arcs} position={[0, 0.02, 0.87]} visible={false}>
            <mesh position={[-0.27, 0.1, 0]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.1, 0.026, 8, 20, Math.PI]} />
              <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            <mesh position={[0.27, 0.1, 0]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.1, 0.026, 8, 20, Math.PI]} />
              <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>

          {/* boca-barra de voz */}
          <mesh ref={mouth} position={[0, -0.2, 0.88]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.028, 0.2, 6, 12]} />
            <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={1} toneMapped={false} />
          </mesh>
        </group>

        {/* gema crestal */}
        <mesh ref={gem} position={[0, 1.06, 0]}>
          <sphereGeometry args={[0.075, 20, 20]} />
          <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      </group>

      {/* ── anillos giroscópicos ── */}
      <mesh ref={ring1} rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[1.34, 0.016, 12, 96]} />
        <meshStandardMaterial color="#131c2c" metalness={0.85} roughness={0.3} emissive="#10B981" emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={bead1}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={3.4} toneMapped={false} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 1.72, 0.4, 0]}>
        <torusGeometry args={[1.52, 0.011, 10, 96]} />
        <meshStandardMaterial color="#131c2c" metalness={0.85} roughness={0.3} emissive="#10B981" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={bead2}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshStandardMaterial color="#0a0f18" emissive="#10B981" emissiveIntensity={3.2} toneMapped={false} />
      </mesh>
      <mesh ref={ring3} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.7, 0.007, 8, 96]} />
        <meshStandardMaterial color="#131c2c" metalness={0.8} roughness={0.35} emissive="#10B981" emissiveIntensity={0.3} />
      </mesh>

      {/* ── partículas orbitales ── */}
      <points ref={particles} rotation={[0.25, 0, 0.12]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(particleData.meta.length * 3), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.038} transparent opacity={0.65} color="#10B981"
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
        />
      </points>

      {/* ── halo de energía en el suelo ── */}
      <mesh ref={halo} position={[0, -1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial map={glowTex} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} color="#10B981" />
      </mesh>
      <mesh position={[0, -1.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05, 0.012, 8, 72]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* ── iluminación de ánimo ── */}
      <pointLight ref={rimL} position={[-2.6, 1.2, -1.6]} intensity={7} distance={9} decay={2} color="#10B981" />
      <pointLight ref={rimR} position={[2.6, -0.8, -1.4]} intensity={4} distance={9} decay={2} color="#38BDF8" />
    </group>
  )
}

export function NexusScene3D({ state = 'idle', interactive = true }: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.25, 4.7], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
      aria-label={`NEXUS avatar 3D — estado ${state}`}
      role="img"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4.5, 5]} intensity={1.25} color="#eef6ff" />
      <directionalLight position={[-4, -2, 2]} intensity={0.35} color="#9df5d8" />

      {/* entorno procedural local (reflejos del cromo sin descargar HDR) */}
      <Environment resolution={128}>
        <Lightformer intensity={2.4} position={[0, 4, 2]} scale={[7, 2, 1]} color="#bff5e2" />
        <Lightformer intensity={1.6} position={[-4, 0, 1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color="#38BDF8" />
        <Lightformer intensity={1.2} position={[4, -1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} color="#A78BFA" />
        <Lightformer intensity={0.8} position={[0, -4, 2]} scale={[7, 2, 1]} color="#0ea5a4" />
      </Environment>

      <NexusModel state={state} interactive={interactive} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.9} luminanceThreshold={0.32} luminanceSmoothing={0.28} mipmapBlur radius={0.72} />
        <Vignette offset={0.18} darkness={0.32} />
      </EffectComposer>
    </Canvas>
  )
}
