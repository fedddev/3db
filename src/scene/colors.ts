import { Color } from 'three'

export const BACKGROUND = '#070b14'

// Tuned to stay distinct against the dark world.
const CATEGORICAL = ['#4e9af1', '#f2a93b', '#e5566b', '#46c28e', '#b27cf0', '#f07ec8', '#5fd0dd', '#c9d35a', '#ff8a5c', '#a0aec8'].map(
  (hex) => new Color(hex),
)
export const CATEGORY_LIMIT = CATEGORICAL.length
const OTHER = new Color('#5b6478')
const RAMP = ['#3d63d6', '#2f9ee0', '#34cdb4', '#a6e36b', '#ffe45c'].map((hex) => new Color(hex))

export const DEFAULT_COLOR = new Color('#7aa2ff')
export const MUTED = new Color('#1b2233')

export const categorical = (rank: number) => (rank < CATEGORICAL.length ? CATEGORICAL[rank] : OTHER)

export function sequential(t: number, out = new Color()) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  return out.lerpColors(RAMP[i], RAMP[i + 1], x - i)
}

export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.map((c) => `#${c.getHexString()}`).join(', ')})`
export const toCss = (c: Color) => `#${c.getHexString()}`
