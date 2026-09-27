import { Grid, Stars, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3, type Group } from 'three'
import { START_POSITION, useStore } from '../store'
import bodyFont from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import displayFont from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?url'
import { BACKGROUND, BASE, FLOOR_CELL, FLOOR_LINE, SURFACE } from './colors'
import { CORNER_YAW, titlePlacement } from './layout'
import { Navigation } from './Navigation'
import { Records } from './Records'
import { Splash } from './Splash'

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
      {/* Its own boundary: when the first world's title font starts loading,
          the shared boundary above hides its children, which made the
          splash blink out before fading. */}
      <Suspense fallback={null}>
        <Splash />
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

// A solid floor, so the stars are only a sky. In the map layout it turns
// see-through, because rows with a depth hang below it.
function Floor() {
  const seeThrough = useStore((s) => s.layout?.mode === 'geo')
  return (
    <>
      <Grid
        rotation-y={CORNER_YAW}
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
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color={SURFACE} transparent={seeThrough} opacity={seeThrough ? 0.55 : 1} depthWrite={!seeThrough} />
      </mesh>
    </>
  )
}

// Group names are painted on the floor like street names, in the gap beside
// each group and reading along it, so they never pile up in the distance.
function GroupLabels() {
  const groups = useStore((s) => s.layout?.groups)
  const yaw = useStore((s) => s.layout?.yaw ?? 0)
  // Lying flat, turned with the layout, so the text runs along the group and
  // reads away from the viewer (checked on screen from the start and overview).
  const quaternion = useMemo(() => {
    const turn = new Matrix4().makeRotationY(yaw)
    const basis = new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
    return new Quaternion().setFromRotationMatrix(turn.multiply(basis))
  }, [yaw])
  if (!groups?.length) return null
  return groups.map((g) => {
    const text = `${g.key}  ·  ${g.count}`
    return (
      <Text
        key={g.key}
        position={[g.street.at[0], 0.02, g.street.at[2]]}
        quaternion={quaternion}
        fontSize={Math.max(0.4, Math.min(1.4, g.street.length / (text.length * 0.6)))}
        font={bodyFont}
        color={BASE}
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
    )
  })
}

// The world's name, like the 2018 app's "THREE DB" sign.
function Title() {
  const layout = useStore((s) => s.layout)
  const name = useStore((s) => (s.activeId ? s.datasets[s.activeId]?.def.name : null))
  if (!layout || !name) return null
  const { position, size } = titlePlacement(layout, START_POSITION)
  return (
    <Text
      position={position}
      anchorY="bottom"
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
