import { PointerLockControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { getState, setState } from '../store'
import { isTyping } from '../ui/keys'

const UP = new Vector3(0, 1, 0)
const WALK = 12
const RUN = 45
const FLIGHT_SECONDS = 1.6

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// WASD walks, Space/E rises, C/Q sinks, Shift runs, arrow keys walk and turn
// (so you can explore without pointer lock). Flights from commands animate the
// camera, and any movement key takes control back.
export function Navigation() {
  const keys = useRef(new Set<string>())
  const flight = useRef<{ id: number; from: Vector3; to: Vector3; qFrom: Quaternion; qTo: Quaternion; t: number } | null>(null)
  const tmp = useRef({ forward: new Vector3(), right: new Vector3(), m: new Matrix4() })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return
      keys.current.add(e.code)
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const k = keys.current
    const has = (...codes: string[]) => (codes.some((c) => k.has(c)) ? 1 : 0)
    const forward = has('KeyW', 'ArrowUp') - has('KeyS', 'ArrowDown')
    const strafe = has('KeyD') - has('KeyA')
    const turn = has('ArrowLeft') - has('ArrowRight')
    const rise = has('Space', 'KeyE') - has('KeyC', 'KeyQ')
    const moving = forward || strafe || turn || rise

    if (moving) {
      if (flight.current) {
        flight.current = null
        setState({ flight: null })
      }
      const speed = has('ShiftLeft', 'ShiftRight') ? RUN : WALK
      const { forward: f, right: r } = tmp.current
      if (turn) camera.rotateOnWorldAxis(UP, turn * dt * 1.8)
      camera.getWorldDirection(f)
      f.y = 0
      f.normalize()
      r.crossVectors(f, UP)
      camera.position.addScaledVector(f, forward * speed * dt).addScaledVector(r, strafe * speed * dt)
      camera.position.y += rise * speed * dt
      return
    }

    const requested = getState().flight
    if (requested && flight.current?.id !== requested.id) {
      const to = new Vector3(...requested.position)
      const look = new Vector3(...requested.lookAt)
      tmp.current.m.lookAt(to, look, UP)
      flight.current = {
        id: requested.id,
        from: camera.position.clone(),
        to,
        qFrom: camera.quaternion.clone(),
        qTo: new Quaternion().setFromRotationMatrix(tmp.current.m),
        t: 0,
      }
    }
    const f = flight.current
    if (!f) return
    f.t = Math.min(1, f.t + dt / FLIGHT_SECONDS)
    const e = easeInOut(f.t)
    camera.position.lerpVectors(f.from, f.to, e)
    camera.quaternion.slerpQuaternions(f.qFrom, f.qTo, e)
    if (f.t === 1) {
      flight.current = null
      setState({ flight: null })
    }
  })

  return (
    <PointerLockControls
      selector="#world canvas"
      onLock={() => setState({ locked: true, hovered: null })}
      onUnlock={() => setState({ locked: false, hovered: null })}
    />
  )
}
