import { Euler, Quaternion, Vector3 } from 'three'
import { say, setState } from '../store'

// Phone head tracking: the gyroscope turns the camera (look only; voice moves you).
// Only offered on touch devices that expose orientation events.
export const headSupported = typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches

type Permissioned = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

// iOS asks for motion access, and only from a tap, so call this from a click handler.
export async function enableHead() {
  const ctor = DeviceOrientationEvent as Permissioned
  if (ctor.requestPermission) {
    const result = await ctor.requestPermission().catch(() => 'denied' as const)
    if (result !== 'granted') {
      say('Motion access was blocked. Allow it in the browser settings to look around by moving your phone.')
      return
    }
  }
  setState({ head: true })
}

export const disableHead = () => setState({ head: false })

const DEG = Math.PI / 180
const euler = new Euler()
const q = new Quaternion()
const q0 = new Quaternion()
const BACK_CAMERA = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2) // the camera looks out the back of the phone
const Z = new Vector3(0, 0, 1)

export interface Orientation {
  alpha: number
  beta: number
  gamma: number
}

// Where the phone is pointing, as a yaw and pitch in radians (same turn direction
// as the camera). Only changes in these are applied, so the compass heading
// never matters: you keep facing whatever the camera was facing.
export function headView(o: Orientation, out: { yaw: number; pitch: number }) {
  euler.set(o.beta * DEG, o.alpha * DEG, -o.gamma * DEG, 'YXZ')
  q.setFromEuler(euler).multiply(BACK_CAMERA).multiply(q0.setFromAxisAngle(Z, -(screen.orientation?.angle ?? 0) * DEG))
  euler.setFromQuaternion(q, 'YXZ')
  out.yaw = euler.y
  out.pitch = euler.x
}
