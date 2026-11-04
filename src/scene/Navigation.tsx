import { PointerLockControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { EYE_HEIGHT, getState, say, setState, useStore } from '../store'
import { headView, type Orientation } from './head'
import { GAZE_RATE } from './layout'
import { isTyping } from '../ui/keys'

const UP = new Vector3(0, 1, 0)
const WALK = 12
const RUN = 45
const FLIGHT_SECONDS = 1.6
// Turning the phone this much (leaky sum, radians) takes a gaze back from it; hand tremor stays below.
const HEAD_CANCEL = 0.03

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// FPS controls: the mouse looks (click to capture it), WASD or the arrow keys
// walk and strafe, Space/E rises, C/Q sinks but never below eye height, Shift
// runs. Flights from commands animate the camera, and a gaze turns it in place
// (up to a new world's title); any movement key or mouse look takes control back.
// On a phone, turning the device looks around (head tracking) and cancels a gaze too.
export function Navigation() {
  const head = useStore((s) => s.head)
  const orientation = useRef<Orientation | null>(null)
  const lastView = useRef<{ yaw: number; pitch: number } | null>(null)
  const view = useRef({ yaw: 0, pitch: 0 })
  const headMoved = useRef(0)
  const euler = useRef(new Euler())
  const keys = useRef(new Set<string>())
  const flight = useRef<{ id: number; from: Vector3; to: Vector3; qFrom: Quaternion; qTo: Quaternion; t: number } | null>(null)
  const gaze = useRef<{ id: number; q: Quaternion } | null>(null)
  const tmp = useRef({ forward: new Vector3(), right: new Vector3(), m: new Matrix4() })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return
      keys.current.add(e.code)
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const clear = () => keys.current.clear()
    // Looking around with a captured mouse cancels a gaze in progress.
    const look = (e: MouseEvent) => {
      if (!getState().locked || !(e.movementX || e.movementY) || !gaze.current) return
      gaze.current = null
      setState({ gaze: null })
    }
    window.addEventListener('mousemove', look)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.removeEventListener('mousemove', look)
    }
  }, [])

  useEffect(() => {
    if (!head) {
      orientation.current = null
      lastView.current = null
      return
    }
    const on = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) {
        setState({ head: false })
        say("This device doesn't report its motion, so it can't look around.")
        return
      }
      orientation.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma }
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [head])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)

    // Head tracking: add the phone's turn since last frame to the camera's own
    // yaw and pitch (never roll). Flights and held gazes own the camera, so the
    // turn is ignored then, but a real turn ends a gaze.
    const o = orientation.current
    if (o) {
      const v = view.current
      headView(o, v)
      const last = lastView.current
      if (last) {
        let dYaw = v.yaw - last.yaw
        if (dYaw > Math.PI) dYaw -= 2 * Math.PI
        else if (dYaw < -Math.PI) dYaw += 2 * Math.PI
        const dPitch = v.pitch - last.pitch
        headMoved.current = headMoved.current * 0.9 + Math.abs(dYaw) + Math.abs(dPitch)
        if (headMoved.current > HEAD_CANCEL && (gaze.current || getState().gaze)) {
          gaze.current = null
          setState({ gaze: null })
        }
        if (!gaze.current && !getState().gaze && !flight.current && !getState().flight) {
          const e = euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
          e.y += dYaw
          e.x = MathUtils.clamp(e.x + dPitch, -1.5, 1.5)
          e.z = 0
          camera.quaternion.setFromEuler(e)
        }
      }
      lastView.current = { yaw: v.yaw, pitch: v.pitch }
    }
    const k = keys.current
    const has = (...codes: string[]) => (codes.some((c) => k.has(c)) ? 1 : 0)
    const forward = has('KeyW', 'ArrowUp') - has('KeyS', 'ArrowDown')
    const strafe = has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft')
    const rise = has('Space', 'KeyE') - has('KeyC', 'KeyQ')
    const moving = forward || strafe || rise

    if (moving) {
      if (flight.current) {
        flight.current = null
        setState({ flight: null })
      }
      if (gaze.current) {
        gaze.current = null
        setState({ gaze: null })
      }
      const speed = has('ShiftLeft', 'ShiftRight') ? RUN : WALK
      const { forward: f, right: r } = tmp.current
      camera.getWorldDirection(f)
      f.y = 0
      f.normalize()
      r.crossVectors(f, UP)
      camera.position.addScaledVector(f, forward * speed * dt).addScaledVector(r, strafe * speed * dt)
      camera.position.y = Math.max(EYE_HEIGHT, camera.position.y + rise * speed * dt)
      return
    }

    const wanted = getState().gaze
    if (wanted && gaze.current?.id !== wanted.id) {
      tmp.current.m.lookAt(camera.position, new Vector3(...wanted.target), UP)
      gaze.current = { id: wanted.id, q: new Quaternion().setFromRotationMatrix(tmp.current.m) }
    }
    const g = gaze.current
    if (g && !getState().flight) {
      camera.quaternion.slerp(g.q, 1 - Math.exp(-dt * GAZE_RATE))
      if (camera.quaternion.angleTo(g.q) < 0.001) {
        gaze.current = null
        setState({ gaze: null })
      }
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
