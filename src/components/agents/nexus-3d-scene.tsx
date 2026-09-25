'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { Nexus3DState } from './nexus-3d'

interface SceneProps {
  state: Nexus3DState
  interactive: boolean
}

const STATE_COLOR: Record<Nexus3DState, string> = {
  idle: '#10B981',
  listening: '#F59E0B',
  thinking: '#38BDF8',
  speaking: '#10B981',
  happy: '#22C55E',
  alert: '#F43F5E',
  trading: '#A78BFA',
}

function CyberHumanoid({ state, interactive }: SceneProps) {
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  const chest = useRef<THREE.Mesh>(null)
  const visor = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)

  const color = useMemo(() => new THREE.Color(STATE_COLOR[state]), [state])
  const accent = useMemo(() => new THREE.Color('#38BDF8'), [])
  const pointer = useRef(new THREE.Vector2())
  const target = useRef(new THREE.Vector2())

  useFrame((ctx, dt) => {
    const t = ctx.clock.getElapsedTime()
    if (interactive) {
      target.current.set(ctx.pointer.x, ctx.pointer.y)
      pointer.current.lerp(target.current, 1 - Math.exp(-dt * 5))
    }

    const px = pointer.current.x
    const py = pointer.current.y

    if (root.current) {
      const idleBob = Math.sin(t * 1.7) * 0.035
      root.current.position.y = idleBob
      root.current.rotation.y += (px * 0.18 - root.current.rotation.y) * (1 - Math.exp(-dt * 2.8))
      root.current.rotation.x += (-py * 0.07 - root.current.rotation.x) * (1 - Math.exp(-dt * 2.2))
      if (state === 'trading') root.current.position.y += Math.sin(t * 8) * 0.025
      if (state === 'alert') root.current.rotation.z = Math.sin(t * 10) * 0.012
      else root.current.rotation.z += (0 - root.current.rotation.z) * (1 - Math.exp(-dt * 5))
    }

    if (head.current) {
      const ty = THREE.MathUtils.clamp(px * 0.32, -0.35, 0.35)
      const tx = THREE.MathUtils.clamp(-py * 0.16, -0.18, 0.18) + (state === 'listening' ? -0.04 : 0)
      head.current.rotation.y += (ty - head.current.rotation.y) * (1 - Math.exp(-dt * 4))
      head.current.rotation.x += (tx - head.current.rotation.x) * (1 - Math.exp(-dt * 4))
    }

    if (eyes.current) {
      eyes.current.position.x = THREE.MathUtils.clamp(px * 0.045, -0.06, 0.06)
      eyes.current.position.y = THREE.MathUtils.clamp(py * 0.025, -0.025, 0.025)
    }

    if (mouth.current) {
      const m = mouth.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(color)
      const talking = state === 'speaking'
      const amp = talking ? 0.65 + Math.abs(Math.sin(t * 8.5)) * 0.55 : 0.8
      mouth.current.scale.set(0.7 + amp * 0.18, talking ? 0.7 + amp * 0.45 : 0.7, 1)
      m.emissiveIntensity = talking ? 3.4 : 1.2
    }

    if (chest.current) {
      const m = chest.current.material as THREE.MeshStandardMaterial
      m.emissive.copy(color)
      m.emissiveIntensity = 2 + (state === 'thinking' ? Math.sin(t * 7) * 0.7 : 0) + (state === 'alert' ? Math.sin(t * 14) * 2 : 0)
      chest.current.scale.setScalar(1 + (state === 'speaking' ? Math.sin(t * 7) * 0.035 : 0))
    }

    if (visor.current) {
      const m = visor.current.material as THREE.MeshPhysicalMaterial
      m.emissive.copy(color)
      m.emissiveIntensity = state === 'alert' ? 2.8 : 0.9
    }

    if (leftArm.current && rightArm.current) {
      const gesture = state === 'speaking' ? Math.sin(t * 2.2) * 0.06 : state === 'thinking' ? 0.035 : 0
      leftArm.current.rotation.z += (-0.05 + gesture - leftArm.current.rotation.z) * (1 - Math.exp(-dt * 3))
      rightArm.current.rotation.z += (0.05 - gesture - rightArm.current.rotation.z) * (1 - Math.exp(-dt * 3))
    }

    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial
      m.color.copy(color)
      m.opacity = 0.2 + Math.sin(t * 2.5) * 0.04 + (state === 'alert' ? 0.13 : 0)
      halo.current.rotation.z = t * 0.08
      halo.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.025)
    }
  })

  return (
    <group ref={root} position={[0, -0.3, 0]}>
      {/* torso */}
      <mesh position={[0, -0.55, 0]} scale={[0.9, 1.05, 0.5]} castShadow>
        <capsuleGeometry args={[0.52, 0.9, 8, 24]} />
        <meshPhysicalMaterial color="#111827" metalness={0.88} roughness={0.23} clearcoat={1} clearcoatRoughness={0.15} />
      </mesh>

      {/* shoulder armor */}
      <mesh position={[-0.76, -0.34, 0]} rotation={[0, 0, -0.18]} scale={[0.42, 0.28, 0.34]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial color="#172033" metalness={0.9} roughness={0.22} clearcoat={1} />
      </mesh>
      <mesh position={[0.76, -0.34, 0]} rotation={[0, 0, 0.18]} scale={[0.42, 0.28, 0.34]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial color="#172033" metalness={0.9} roughness={0.22} clearcoat={1} />
      </mesh>

      {/* arms */}
      <group ref={leftArm} position={[-0.83, -0.68, 0]}>
        <mesh rotation={[0, 0, 0.12]} position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.16, 0.62, 6, 16]} />
          <meshPhysicalMaterial color="#0d1524" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[-0.05, -0.62, 0]}>
          <sphereGeometry args={[0.19, 18, 14]} />
          <meshPhysicalMaterial color="#182338" metalness={0.9} roughness={0.22} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.83, -0.68, 0]}>
        <mesh rotation={[0, 0, -0.12]} position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.16, 0.62, 6, 16]} />
          <meshPhysicalMaterial color="#0d1524" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.05, -0.62, 0]}>
          <sphereGeometry args={[0.19, 18, 14]} />
          <meshPhysicalMaterial color="#182338" metalness={0.9} roughness={0.22} />
        </mesh>
      </group>

      {/* neck */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.35, 24]} />
        <meshPhysicalMaterial color="#202b40" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* head */}
      <group ref={head} position={[0, 0.92, 0]}>
        <mesh scale={[0.82, 0.92, 0.72]} castShadow>
          <sphereGeometry args={[1, 48, 36]} />
          <meshPhysicalMaterial color="#0b1220" metalness={0.9} roughness={0.2} clearcoat={1} clearcoatRoughness={0.12} />
        </mesh>

        {/* glass face / visor */}
        <mesh ref={visor} position={[0, -0.02, 0.61]} scale={[0.66, 0.5, 0.12]}>
          <sphereGeometry args={[1, 40, 24]} />
          <meshPhysicalMaterial color="#050914" metalness={0.35} roughness={0.16} transmission={0.08} transparent opacity={0.92} clearcoat={1} emissive="#10B981" />
        </mesh>

        {/* eyes */}
        <group ref={eyes}>
          <mesh position={[-0.25, 0.07, 0.7]}>
            <capsuleGeometry args={[0.055, 0.15, 6, 16]} />
            <meshStandardMaterial color="#071016" emissive="#10B981" emissiveIntensity={3.2} toneMapped={false} />
          </mesh>
          <mesh position={[0.25, 0.07, 0.7]}>
            <capsuleGeometry args={[0.055, 0.15, 6, 16]} />
            <meshStandardMaterial color="#071016" emissive="#10B981" emissiveIntensity={3.2} toneMapped={false} />
          </mesh>
        </group>

        {/* mouth / voice line */}
        <mesh ref={mouth} position={[0, -0.22, 0.72]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.18, 6, 12]} />
          <meshStandardMaterial color="#071016" emissive="#10B981" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>

        {/* crown light */}
        <mesh position={[0, 0.91, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#071016" emissive="#10B981" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>

      {/* chest intelligence core */}
      <mesh ref={chest} position={[0, -0.38, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.045, 32]} />
        <meshStandardMaterial color="#061014" emissive="#10B981" emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* status spine */}
      <mesh position={[0, -0.72, 0.48]}>
        <boxGeometry args={[0.045, 0.52, 0.025]} />
        <meshStandardMaterial color="#061014" emissive="#38BDF8" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* energy halo */}
      <mesh ref={halo} position={[0, -1.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 1.28, 64]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

function NexusScene3D({ state, interactive }: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.05, 4.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      shadows
      style={{ background: 'transparent' }}
      aria-label={`NEXUS humanoid 3D — estado ${state}`}
      role="img"
    >
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 4, 5]} intensity={1.35} color="#eef6ff" castShadow />
      <pointLight position={[-3, 1.8, 2]} intensity={5} distance={8} color={STATE_COLOR[state]} />
      <pointLight position={[3, -0.5, 1]} intensity={3} distance={7} color="#38BDF8" />

      <Environment resolution={96}>
        <Lightformer intensity={2.4} position={[0, 4, 2]} scale={[6, 2, 1]} color="#d9fff0" />
        <Lightformer intensity={1.5} position={[-4, 0, 1]} rotation-y={Math.PI / 2} scale={[5, 2, 1]} color="#38BDF8" />
        <Lightformer intensity={1.2} position={[4, -1, 1]} rotation-y={-Math.PI / 2} scale={[5, 2, 1]} color="#A78BFA" />
      </Environment>

      <CyberHumanoid state={state} interactive={interactive} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.72} luminanceThreshold={0.28} luminanceSmoothing={0.25} mipmapBlur radius={0.65} />
        <Vignette offset={0.2} darkness={0.3} />
      </EffectComposer>
    </Canvas>
  )
}

export { NexusScene3D }
