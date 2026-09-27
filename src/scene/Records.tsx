import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, InstancedMesh, LineSegments, Vector2 } from 'three'
import { ROW_LIMIT } from '../data/query'
import { getState, setState, useStore } from '../store'
import { BASE, FERN } from './colors'
import { EASE_RATE } from './layout'

// The animated state of every box, shared with the highlight outlines.
// Boxes ease toward the layout's targets each frame, so every change to the
// view is a physical rearrangement you can watch.
const live = {
  pos: new Float32Array(ROW_LIMIT * 3),
  size: new Float32Array(ROW_LIMIT * 3),
  color: new Float32Array(ROW_LIMIT * 3),
  yaw: 0,
  n: 0,
  settled: true,
}

const unitBox = () => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const CENTER = new Vector2(0, 0)

export function Records() {
  const layout = useStore((s) => s.layout)
  const mesh = useRef<InstancedMesh>(null!)
  const geometry = useMemo(() => unitBox(), [])
  const frame = useRef(0)
  const { camera, raycaster } = useThree()

  useEffect(() => {
    // No world yet: draw nothing, not a pile of unplaced boxes at the origin.
    if (!layout) return void (mesh.current.count = 0)
    // The first world arrives already turned; later layout changes turn smoothly.
    if (live.n === 0) live.yaw = layout.yaw
    // New boxes rise out of the floor at their destination.
    for (let i = live.n; i < layout.n; i++) {
      const o = i * 3
      live.pos.set(layout.pos.subarray(o, o + 3), o)
      live.size.set([layout.size[o], 0.001, layout.size[o + 2]], o)
      live.color.set(layout.color.subarray(o, o + 3), o)
    }
    live.n = layout.n
    live.settled = false
    mesh.current.count = layout.n
  }, [layout])

  useFrame((_, dt) => {
    const m = mesh.current
    if (layout && !live.settled) {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * EASE_RATE)
      let moving = 0
      for (let j = 0; j < layout.n * 3; j++) {
        const dp = layout.pos[j] - live.pos[j]
        const ds = layout.size[j] - live.size[j]
        live.pos[j] += dp * k
        live.size[j] += ds * k
        const dc = layout.color[j] - live.color[j]
        live.color[j] += dc * k
        moving = Math.max(moving, Math.abs(dp), Math.abs(ds), Math.abs(dc))
      }
      const dy = layout.yaw - live.yaw
      live.yaw += dy * k
      moving = Math.max(moving, Math.abs(dy))
      const cos = Math.cos(live.yaw), sin = Math.sin(live.yaw)
      const matrices = m.instanceMatrix.array as Float32Array
      for (let i = 0; i < layout.n; i++) {
        const o = i * 3
        const e = i * 16
        matrices.fill(0, e, e + 16)
        // Rotation about y times scale, column-major.
        matrices[e] = cos * live.size[o]
        matrices[e + 2] = -sin * live.size[o]
        matrices[e + 5] = Math.max(live.size[o + 1], 0.001)
        matrices[e + 8] = sin * live.size[o + 2]
        matrices[e + 10] = cos * live.size[o + 2]
        matrices[e + 12] = live.pos[o]
        matrices[e + 13] = live.pos[o + 1]
        matrices[e + 14] = live.pos[o + 2]
        matrices[e + 15] = 1
      }
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
      live.settled = moving < 0.002
      // Raycasting culls by bounding sphere, so recompute it as boxes move.
      if (live.settled || frame.current % 15 === 0) m.boundingSphere = null
    }

    // With the pointer locked, the crosshair is the cursor: pick at screen center.
    if (getState().locked && ++frame.current % 4 === 0) {
      raycaster.setFromCamera(CENTER, camera)
      const hit = raycaster.intersectObject(m)[0]
      const hovered = hit?.instanceId ?? null
      if (hovered !== getState().hovered) setState({ hovered })
    }
  })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) setState({ selected: getState().hovered })
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (getState().locked) return
    e.stopPropagation()
    setState({ hovered: e.instanceId ?? null })
  }

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, ROW_LIMIT]}
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={() => !getState().locked && setState({ hovered: null })}
      >
        <instancedBufferAttribute attach="instanceColor" args={[live.color, 3]} />
        <meshStandardMaterial roughness={0.9} metalness={0} />
      </instancedMesh>
      <Outline which="hovered" color={BASE} opacity={0.6} />
      <Outline which="selected" color={FERN} opacity={1} />
    </>
  )
}

function Outline({ which, color, opacity }: { which: 'hovered' | 'selected'; color: string; opacity: number }) {
  const index = useStore((s) => s[which])
  const ref = useRef<LineSegments>(null!)
  const geometry = useMemo(() => new EdgesGeometry(unitBox()), [])

  useFrame(() => {
    const line = ref.current
    line.visible = index !== null && index < live.n
    if (!line.visible) return
    const o = index! * 3
    line.position.set(live.pos[o], live.pos[o + 1] - 0.03, live.pos[o + 2])
    line.rotation.y = live.yaw
    line.scale.set(live.size[o] + 0.12, Math.max(live.size[o + 1], 0.01) + 0.08, live.size[o + 2] + 0.12)
  })

  return (
    <lineSegments ref={ref} geometry={geometry} visible={false}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}
