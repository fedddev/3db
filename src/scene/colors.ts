import { Color } from 'three'

// fedddev dark mode (brand/BRAND.md §8, §8a). The world is always a night
// jungle; records are the fruit.
export const BACKGROUND = '#0F2A24' // jungle: clear color and fog
export const SURFACE = '#173D34' // jungle-surface: floor
export const BASE = '#F6EBD9' // frangipani: labels, hover outline
export const FERN = '#A9D8A0' // selection outline
// Floor lines stay recessive: fern is data colour 1 and would blend into a fern grid.
export const FLOOR_LINE = '#598365'
export const FLOOR_CELL = '#264437'

// Brand trio (fern, mango, papaya) plus five hues ordered so neighbours stay
// apart under colour-blind simulation (dataviz validator, dark mode on jungle:
// adjacent CVD ΔE ≥ 16, normal ΔE ≥ 27). A ninth category folds into "other".
const CATEGORICAL = ['#A9D8A0', '#9C7BE0', '#F4B942', '#E0457B', '#5B9BE6', '#F2784B', '#4FC3D9', '#B5652F'].map(
  (hex) => new Color(hex),
)
export const CATEGORY_LIMIT = CATEGORICAL.length
const OTHER = new Color('#6E7D74')
// One hue (papaya), dim to bright: high values glow against the jungle.
const RAMP = ['#A04528', '#CE5A33', '#F2784B', '#F7A67F', '#FBD3BC'].map((hex) => new Color(hex))

export const DEFAULT_COLOR = new Color('#F2784B') // papaya
export const MUTED = new Color('#264437')

export const categorical = (rank: number) => (rank < CATEGORICAL.length ? CATEGORICAL[rank] : OTHER)

export function sequential(t: number, out = new Color()) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  return out.lerpColors(RAMP[i], RAMP[i + 1], x - i)
}

export const toCss = (c: Color) => `#${c.getHexString()}`
