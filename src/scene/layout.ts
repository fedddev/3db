// Turns query results into places. Every row becomes a box with a base
// position, a size and a color; the Records component animates toward these
// targets, so changing the view physically rearranges the world.

import { Color } from 'three'
import type { LayoutMode } from '../commands/types'
import { MATCH } from '../data/query'
import type { Column, Dataset, Row, Value, ViewSpec } from '../types'
import { CATEGORY_LIMIT, DEFAULT_COLOR, MUTED, categorical, sequential, toCss } from './colors'

export interface GroupInfo {
  key: string
  count: number
  center: [number, number, number]
  // A street name on the floor in the gap left of the group, reading along it
  // (away from the viewer). `at` is its center; the text lies flat, turned by
  // the layout's yaw.
  street: { at: [number, number, number]; length: number }
  top: number
  width: number
}

export type Legend =
  | { field: string; kind: 'categorical'; entries: { label: string; color: string }[] }
  | { field: string; kind: 'sequential'; min: Value; max: Value; column: Column }

export interface Layout {
  n: number
  pos: Float32Array // base (x, y, z): boxes grow upward from y
  size: Float32Array // (width, height, depth)
  color: Float32Array
  matches: number
  groups: GroupInfo[]
  min: [number, number, number]
  max: [number, number, number]
  mode: LayoutMode
  yaw: number // rotation of every box about y (the corner view turns them 45°)
  legend: Legend | null
  note: string | null
}

// How fast boxes ease toward their targets: the remaining distance shrinks by
// e^-EASE_RATE per second. The camera's glance up to a new world's title is
// slower, so the skyline is mostly built by the time you're looking at it.
export const EASE_RATE = 5
export const GAZE_RATE = EASE_RATE / 3

const SPACING = 1.6
const GAP = 4
// Grid and timeline worlds are turned 45° with their near corner here, so from
// the start point (0, 1.6, 10) you look straight at a corner and both sides
// recede to their own vanishing point.
const FRONT_Z = 0
export const CORNER_YAW = Math.PI / 4
const MAX_GROUPS = 40

type Unit = (v: Value) => number | null

function numericRange(rows: Row[], field: string) {
  let min = Infinity
  let max = -Infinity
  for (const r of rows) {
    const v = r[field]
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return min <= max ? { min, max } : null
}

// Maps a numeric field to 0..1. Non-negative fields use a square root so a few
// giant values (one huge order, one outlier reading) don't flatten everything else.
function heightUnit(rows: Row[], field: string): Unit {
  const r = numericRange(rows, field)
  if (!r) return () => null
  if (r.min >= 0) {
    const top = Math.sqrt(r.max) || 1
    return (v) => (typeof v === 'number' ? Math.sqrt(v) / top : null)
  }
  const span = r.max - r.min || 1
  return (v) => (typeof v === 'number' ? (v - r.min) / span : null)
}

const fmtNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function timeBucket(min: number, max: number) {
  const days = (max - min) / 86_400_000
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 730) return (t: number) => String(new Date(t).getFullYear())
  if (days > 60) return (t: number) => `${new Date(t).getFullYear()}-${pad(new Date(t).getMonth() + 1)}`
  return (t: number) => {
    const d = new Date(t)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
}

// Splits rows into ordered groups. Numbers with many distinct values become
// ranges, times become years/months/days, and long-tail text collapses into "other".
function groupRows(rows: Row[], col: Column): { key: string; indices: number[] }[] {
  const buckets = new Map<string, { key: string; order: number; indices: number[] }>()
  const add = (key: string, order: number, i: number) => {
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { key, order, indices: [] }))
    b.indices.push(i)
  }
  const range = col.kind === 'number' || col.kind === 'time' ? numericRange(rows, col.name) : null

  if (col.kind === 'time' && range) {
    const bucket = timeBucket(range.min, range.max)
    rows.forEach((r, i) => {
      const v = r[col.name]
      if (typeof v === 'number') add(bucket(v), v, i)
      else add('(none)', Infinity, i)
    })
    // Order by the earliest time in each bucket.
    for (const b of buckets.values()) if (b.order !== Infinity) b.order = Math.min(...b.indices.map((i) => rows[i][col.name] as number))
  } else if (col.kind === 'number' && range) {
    const distinct = new Set(rows.map((r) => r[col.name]))
    const bins = 8
    const width = (range.max - range.min) / bins || 1
    rows.forEach((r, i) => {
      const v = r[col.name]
      if (typeof v !== 'number') return add('(none)', Infinity, i)
      if (distinct.size <= 12) return add(fmtNumber(v), v, i)
      const bin = Math.min(bins - 1, Math.floor((v - range.min) / width))
      const lo = range.min + bin * width
      add(`${fmtNumber(lo)}–${fmtNumber(lo + width)}`, bin, i)
    })
  } else {
    rows.forEach((r, i) => {
      const v = r[col.name]
      add(v === null || v === '' ? '(none)' : String(v), 0, i)
    })
    for (const b of buckets.values()) b.order = -b.indices.length
  }

  const ordered = [...buckets.values()].sort((a, b) => a.order - b.order)
  if (ordered.length <= MAX_GROUPS) return ordered
  const kept = ordered.slice(0, MAX_GROUPS - 1)
  kept.push({ key: 'other', order: Infinity, indices: ordered.slice(MAX_GROUPS - 1).flatMap((b) => b.indices) })
  return kept
}

function colorer(rows: Row[], col: Column | undefined): { colorOf: (r: Row) => Color; legend: Legend | null } {
  if (!col) return { colorOf: () => DEFAULT_COLOR, legend: null }
  if (col.kind === 'number' || col.kind === 'time') {
    const r = numericRange(rows, col.name)
    const span = r ? r.max - r.min || 1 : 1
    const tmp = new Color()
    return {
      colorOf: (row) => {
        const v = row[col.name]
        return typeof v === 'number' && r ? sequential((v - r.min) / span, tmp) : MUTED
      },
      legend: { field: col.name, kind: 'sequential', min: r?.min ?? null, max: r?.max ?? null, column: col },
    }
  }
  const counts = new Map<string, number>()
  for (const row of rows) {
    const k = String(row[col.name])
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const rank = new Map(ranked.map((k, i) => [k, i]))
  const entries = ranked.slice(0, CATEGORY_LIMIT).map((k, i) => ({ label: k, color: toCss(categorical(i)) }))
  if (ranked.length > CATEGORY_LIMIT) entries.push({ label: 'other', color: toCss(categorical(CATEGORY_LIMIT)) })
  return { colorOf: (row) => categorical(rank.get(String(row[col.name])) ?? CATEGORY_LIMIT), legend: { field: col.name, kind: 'categorical', entries } }
}

export function computeLayout(rows: Row[], spec: ViewSpec, ds: Dataset): Layout {
  const n = rows.length
  const pos = new Float32Array(n * 3)
  const size = new Float32Array(n * 3)
  const color = new Float32Array(n * 3)
  const column = (name: string | null) => (name ? ds.columns.find((c) => c.name === name) : undefined)

  let mode = spec.layout
  let note: string | null = null
  if (mode === 'timeline' && !ds.timeField) {
    mode = 'grid'
    note = 'This data has no time column, so there is no timeline. Showing a grid.'
  }
  if (mode === 'geo' && !ds.geo) {
    mode = 'grid'
    note = 'This data has no latitude/longitude, so there is no map. Showing a grid.'
  }

  const groupCol = column(spec.groupBy)
  const groups = groupCol ? groupRows(rows, groupCol) : [{ key: '', indices: rows.map((_, i) => i) }]

  // Heights and colors are the same in every layout.
  const heightCol = column(spec.height)
  const unit = heightCol && heightCol.kind !== 'text' && heightCol.kind !== 'bool' ? heightUnit(rows, heightCol.name) : null
  const maxH = 8
  const footprint = mode === 'geo' ? 0.9 : 1
  const { colorOf, legend } = colorer(rows, column(spec.color))
  let matches = 0
  rows.forEach((row, i) => {
    const matched = row[MATCH] === true
    if (matched) matches++
    const u = unit ? unit(row[heightCol!.name]) : null
    const h = !matched ? 0.12 : unit ? 0.25 + (maxH - 0.25) * (u ?? 0) : mode === 'geo' ? 0.6 : 1
    size.set([footprint, h, footprint], i * 3)
    const c = matched ? colorOf(row) : MUTED
    color.set([c.r, c.g, c.b], i * 3)
  })

  let yaw = 0
  let streets: GroupInfo['street'][] = []
  if (mode === 'geo') {
    placeGeo(rows, ds, pos, size)
    streets = groups.map((g) => streetFor(g.indices, pos))
  } else {
    if (mode === 'timeline') placeTimeline(rows, ds.timeField!, groups, pos)
    else placeGrid(groups, pos)
    // Streets are found in the unturned frame, then turned with everything else.
    streets = groups.map((g) => streetFor(g.indices, pos))
    const turn = turnToCorner(pos, n)
    for (const s of streets) s.at = turn(s.at)
    yaw = CORNER_YAW
  }

  // Bounds and per-group label anchors come from the final placement.
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      const lo = pos[i * 3 + a]
      const hi = lo + (a === 1 ? size[i * 3 + 1] : 0)
      if (lo < min[a]) min[a] = lo
      if (hi > max[a]) max[a] = hi
    }
  }
  if (!n) {
    min.fill(0)
    max.fill(0)
  }

  const groupInfo: GroupInfo[] = groupCol
    ? groups.map((g, gi) => {
        let sx = 0, sz = 0, top = 0, x0 = Infinity, x1 = -Infinity
        for (const i of g.indices) {
          const x = pos[i * 3]
          sx += x
          sz += pos[i * 3 + 2]
          top = Math.max(top, pos[i * 3 + 1] + size[i * 3 + 1])
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
        }
        const c = g.indices.length || 1
        return { key: g.key, count: g.indices.length, center: [sx / c, 0, sz / c], street: streets[gi], top, width: Math.max(x1 - x0, 1) }
      })
    : []

  return { n, pos, size, color, matches, groups: groupInfo, min, max, mode, yaw, legend, note }
}

type Vec3 = [number, number, number]

// The world's name hangs past the far end, high enough that from the eye point
// it clears every box. Returns the text's bottom-center anchor and font size.
export function titlePlacement(layout: Layout, eye: Vec3): { position: Vec3; size: number } {
  const width = layout.max[0] - layout.min[0]
  const size = Math.min(Math.max(width * 0.06, 2.5), 14)
  const x = (layout.min[0] + layout.max[0]) / 2
  const z = layout.min[2] - 4
  const [ex, ey, ez] = eye
  // Steepest sightline from the eye to the top of any box.
  let slope = 0
  for (let i = 0; i < layout.n; i++) {
    const o = i * 3
    const d = Math.hypot(layout.pos[o] - ex, layout.pos[o + 2] - ez)
    slope = Math.max(slope, (layout.pos[o + 1] + layout.size[o + 1] - ey) / Math.max(d, 1))
  }
  const y = Math.max(ey + slope * Math.hypot(x - ex, z - ez) + size * 0.3, layout.max[1] + size * 0.5)
  return { position: [x, y, z], size }
}

// The gap left of a group (its min x), halfway along its z extent.
function streetFor(indices: number[], pos: Float32Array): GroupInfo['street'] {
  let x0 = Infinity, z0 = Infinity, z1 = -Infinity
  for (const i of indices) {
    x0 = Math.min(x0, pos[i * 3])
    z0 = Math.min(z0, pos[i * 3 + 2])
    z1 = Math.max(z1, pos[i * 3 + 2])
  }
  if (!indices.length) return { at: [0, 0, 0], length: 0 }
  return { at: [x0 - SPACING / 2 - GAP / 2, 0, (z0 + z1) / 2], length: z1 - z0 + SPACING }
}

// Pin the front-left corner (min x, max z) at (0, FRONT_Z) and turn the world
// about it: its x side runs off to the right, its -z side off to the left.
// Returns the same transform for other points (e.g. street labels).
function turnToCorner(pos: Float32Array, n: number): (p: Vec3) => Vec3 {
  let x0 = Infinity, z0 = -Infinity
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, pos[i * 3])
    z0 = Math.max(z0, pos[i * 3 + 2])
  }
  x0 = n ? x0 - SPACING / 2 : 0
  z0 = n ? z0 + SPACING / 2 : 0
  const c = Math.cos(CORNER_YAW), s = Math.sin(CORNER_YAW)
  const turn = ([px, py, pz]: Vec3): Vec3 => {
    const x = px - x0, z = pz - z0
    return [x * c + z * s, py, -x * s + z * c + FRONT_Z]
  }
  for (let i = 0; i < n; i++) {
    const [x, , z] = turn([pos[i * 3], 0, pos[i * 3 + 2]])
    pos[i * 3] = x
    pos[i * 3 + 2] = z
  }
  return turn
}

// Groups become districts: square blocks packed onto shelves, biggest first.
function placeGrid(groups: { indices: number[] }[], pos: Float32Array) {
  const blocks = groups.map((g) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(g.indices.length)))
    return { g, cols, w: cols * SPACING, d: Math.ceil(g.indices.length / cols) * SPACING }
  })
  const area = blocks.reduce((s, b) => s + (b.w + GAP) * (b.d + GAP), 0)
  const shelfWidth = Math.max(Math.sqrt(area) * 1.3, ...blocks.map((b) => b.w))

  let x = 0, z = 0, shelfDepth = 0, totalW = 0
  const placed = blocks.map((b) => {
    if (x > 0 && x + b.w > shelfWidth) {
      x = 0
      z -= shelfDepth + GAP
      shelfDepth = 0
    }
    const at = { b, x, z }
    x += b.w + GAP
    totalW = Math.max(totalW, x - GAP)
    shelfDepth = Math.max(shelfDepth, b.d)
    return at
  })
  const totalD = -z + shelfDepth
  for (const { b, x: bx, z: bz } of placed) {
    b.g.indices.forEach((i, k) => {
      pos[i * 3] = bx + (k % b.cols) * SPACING + SPACING / 2 - totalW / 2
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = bz - Math.floor(k / b.cols) * SPACING - SPACING / 2 + totalD / 2
    })
  }
}

// Time runs away from you along -z; each group gets its own lane. Records that
// land at the same moment stack sideways within their lane.
function placeTimeline(rows: Row[], timeField: string, groups: { indices: number[] }[], pos: Float32Array) {
  const range = numericRange(rows, timeField) ?? { min: 0, max: 1 }
  const span = range.max - range.min || 1
  // About as long as it is wide: records from the same period stack sideways,
  // so a short time axis gives a squarer block with depth on both sides.
  const length = Math.min(Math.max(SPACING * Math.sqrt(rows.length), 10), 400)
  let laneX = 0
  const lanes = groups.map((g) => {
    const stacks = new Map<number, number>()
    let widest = 0
    const local = g.indices.map((i) => {
      const t = rows[i][timeField]
      const z = length / 2 - ((typeof t === 'number' ? t - range.min : 0) / span) * length
      const slot = Math.round(z / SPACING)
      const stack = stacks.get(slot) ?? 0
      stacks.set(slot, stack + 1)
      widest = Math.max(widest, stack + 1)
      return { i, z, stack }
    })
    const lane = { x: laneX, local }
    laneX += widest * SPACING + GAP
    return lane
  })
  const totalW = laneX - GAP
  for (const lane of lanes) {
    for (const { i, z, stack } of lane.local) {
      pos[i * 3] = lane.x + stack * SPACING + SPACING / 2 - totalW / 2
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = z
    }
  }
}

// Longitude and latitude on the floor, depth below it.
function placeGeo(rows: Row[], ds: Dataset, pos: Float32Array, size: Float32Array) {
  const { lat, lon, depth } = ds.geo!
  const SCALE = 1.2
  const DEPTH_SCALE = 0.08
  rows.forEach((r, i) => {
    const la = r[lat], lo = r[lon]
    if (typeof la !== 'number' || typeof lo !== 'number') {
      size.set([0, 0.001, 0], i * 3) // nowhere to put it
      return
    }
    const d = depth ? r[depth] : null
    pos[i * 3] = lo * SCALE
    pos[i * 3 + 1] = typeof d === 'number' ? -d * DEPTH_SCALE : 0
    pos[i * 3 + 2] = -la * SCALE
  })
}
