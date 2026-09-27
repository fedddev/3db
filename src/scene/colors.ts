import { Color } from 'three'

// fedddev dark mode (brand/BRAND.md §8, §8a). The world is always a night
// jungle; records are the fruit.
export const BACKGROUND = '#0F2A24' // jungle: clear color and fog
export const SURFACE = '#173D34' // jungle-surface: floor
export const BASE = '#F6EBD9' // frangipani: labels, hover outline
export const MUTED_TEXT = '#C9BFAE' // muted-on-dark: secondary words in the scene
export const FERN = '#A9D8A0' // selection outline
// Floor lines stay recessive (brand §8a secondary lines), since fern is also a
// data color and would blend into a fern grid.
export const FLOOR_LINE = '#598365'
export const FLOOR_CELL = '#264437'

// Data colors are brand colors only (brand/BRAND.md §4): the six that read on
// the jungle ground, ordered so neighbours stay apart under colour-blind
// simulation (dataviz validator on jungle: adjacent CVD ΔE ≥ 18, normal ≥ 26).
// Lagoon and hibiscus are light-mode accents in the brand; in this dark world
// they appear only as data. A seventh category folds into "other".
const CATEGORICAL = ['#F2784B', '#F6EBD9', '#2BA39B', '#F4B942', '#E0457B', '#A9D8A0'].map((hex) => new Color(hex))
export const CATEGORY_LIMIT = CATEGORICAL.length
const OTHER = new Color('#4A5A55') // muted-on-light
// Magnitude, dim to bright on the dark ground: papaya → mango → frangipani.
const RAMP = ['#F2784B', '#F4B942', '#F6EBD9'].map((hex) => new Color(hex))

export const DEFAULT_COLOR = new Color('#F2784B') // papaya
export const MUTED = new Color('#173D34') // jungle-surface: sunk (filtered-out) records

export const categorical = (rank: number) => (rank < CATEGORICAL.length ? CATEGORICAL[rank] : OTHER)

export function sequential(t: number, out = new Color()) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  return out.lerpColors(RAMP[i], RAMP[i + 1], x - i)
}

export const toCss = (c: Color) => `#${c.getHexString()}`
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.map(toCss).join(', ')})`
