import { Billboard, Grid, Stars, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'
import { useStore } from '../store'
import bodyFont from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import displayFont from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?url'
import { BACKGROUND, BASE, FLOOR_CELL, FLOOR_LINE, SURFACE } from './colors'
import { Navigation } from './Navigation'
import { Records } from './Records'

export function World() {
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <Fog />
      <hemisphereLight args={[BASE, BACKGROUND, 1.1]} />
      <directionalLight position={[30, 60, 25]} intensity={1.2} />
      <SlowSky />
      <Floor />
      <Records />
      {/* Text loads its font lazily; keep that suspense inside the canvas so it
          never holds back the rest of the page (it swallowed keystrokes). */}
      <Suspense fallback={null}>
        <GroupLabels />
        <Title />
      </Suspense>
      <Navigation />
    </>
  )
}

// Fog scales with the world, so a planet-wide map isn't swallowed by haze
// meant for a small district.
function Fog() {
  const extent = useStore((s) => (s.layout ? Math.max(s.layout.max[0] - s.layout.min[0], s.layout.max[2] - s.layout.min[2]) : 0))
  const near = Math.max(80, extent * 0.9)
  return <fog attach="fog" args={[BACKGROUND, near, near + Math.max(440, extent * 2.5)]} />
}

// A nod to the 2018 original's slowly rotating sky.
function SlowSky() {
  const ref = useRef<Group>(null!)
  useFrame((_, dt) => void (ref.current.rotation.y += dt * 0.004))
  return (
    <group ref={ref}>
      <Stars radius={600} depth={200} count={4000} factor={6} fade speed={0.3} />
    </group>
  )
}

// A see-through floor: in the map layout, rows with a depth hang below it.
function Floor() {
  return (
    <>
      <Grid
        infiniteGrid
        cellSize={1.6}
        sectionSize={8}
        cellColor={FLOOR_CELL}
        sectionColor={FLOOR_LINE}
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={260}
        fadeStrength={1.5}
      />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} renderOrder={-1}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color={SURFACE} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </>
  )
}

function GroupLabels() {
  const groups = useStore((s) => s.layout?.groups)
  if (!groups?.length) return null
  return groups.map((g) => (
    <Billboard key={g.key} position={[g.center[0], g.top + 1, g.center[2]]}>
      <Text
        fontSize={Math.min(Math.max(g.width * 0.14, 0.6), 3)}
        font={bodyFont}
        color={BASE}
        anchorY="bottom"
        outlineWidth="4%"
        outlineColor={BACKGROUND}
      >
        {`${g.key}  ·  ${g.count}`}
      </Text>
    </Billboard>
  ))
}

// The world's name hangs at the far end, like the 2018 app's "THREE DB" sign.
function Title() {
  const layout = useStore((s) => s.layout)
  const name = useStore((s) => (s.activeId ? s.datasets[s.activeId]?.def.name : null))
  if (!layout || !name) return null
  const width = layout.max[0] - layout.min[0]
  const size = Math.min(Math.max(width * 0.06, 2.5), 14)
  return (
    <Text
      position={[(layout.min[0] + layout.max[0]) / 2, Math.max(layout.max[1], 0) + size * 1.5, layout.min[2] - 12]}
      font={displayFont}
      fontSize={size}
      letterSpacing={-0.03}
      color={BASE}
      anchorX="center"
      fillOpacity={0.85}
    >
      {name}
    </Text>
  )
}
