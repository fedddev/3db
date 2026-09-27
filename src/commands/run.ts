import { csvDataset } from '../data/datasets'
import { loadTable, queryRows, quoteIdent } from '../data/duckdb'
import { buildQuery } from '../data/query'
import { validateCsv } from '../data/validateCsv'
import { CATEGORY_LIMIT } from '../scene/colors'
import { computeLayout, titlePlacement, type Layout } from '../scene/layout'
import { EMPTY_SPEC, START_LOOK_AT, START_POSITION, getState, say, setState, type Vec3 } from '../store'
import type { Column, Dataset, GeoFields, ViewSpec } from '../types'
import { askAi, type AiContext } from './ai'
import { HELP, parse, type ParseContext } from './parse'
import type { Command, Filter, FlyTarget } from './types'



// Clear phrases that earlier builds stored in this browser.
export function boot() {
  try {
    localStorage.removeItem('3db.commandLog')
  } catch {
    // Storage unavailable: nothing was stored either.
  }
  setState({ phase: 'ready' })
}

function detectGeo(columns: Column[]): GeoFields | null {
  const find = (re: RegExp) => columns.find((c) => c.kind === 'number' && re.test(c.name))?.name
  const lat = find(/^(lat|latitude)$/i)
  const lon = find(/^(lon|lng|long|longitude)$/i)
  const depth = find(/^depth$/i)
  return lat && lon ? { lat, lon, depth } : null
}

// For dropped files with no hand-written defaults: map, else timeline, else grid.
function defaultsFor(ds: Dataset): Partial<ViewSpec> {
  if (Object.keys(ds.def.defaults).length) return ds.def.defaults
  const skip = new Set([ds.geo?.lat, ds.geo?.lon])
  const numbers = ds.columns.filter((c) => c.kind === 'number' && !skip.has(c.name)).map((c) => c.name)
  const height = numbers[0] ?? null
  return { layout: ds.geo ? 'geo' : ds.timeField ? 'timeline' : 'grid', height, color: defaultColor(ds, numbers, height) }
}

// Every world arrives in color: the category column with the most values that
// still fit the palette (genre over format over channel), else another number
// on the ramp, else the height itself.
function defaultColor(ds: Dataset, numbers: string[], height: string | null): string | null {
  let best: string | null = null
  for (const c of ds.columns) {
    const n = ds.distinct[c.name] ?? 0
    if (n >= 2 && n <= CATEGORY_LIMIT && n > (best ? ds.distinct[best] : 0)) best = c.name
  }
  return best ?? numbers.find((n) => n !== height) ?? height
}

async function countDistinct(table: string, columns: Column[]): Promise<Record<string, number>> {
  const cats = columns.filter((c) => c.kind === 'text' || c.kind === 'bool')
  if (!cats.length) return {}
  const [row] = await queryRows(`SELECT ${cats.map((c, i) => `COUNT(DISTINCT ${quoteIdent(c.name)}) AS c${i}`).join(', ')} FROM ${quoteIdent(table)}`)
  return Object.fromEntries(cats.map((c, i) => [c.name, Number(row?.[`c${i}`] ?? 0)]))
}

export async function activate(id: string) {
  const def = getState().defs.find((d) => d.id === id)
  if (!def) return say(`There's no world called "${id}".`)
  let ds = getState().datasets[id]
  if (!ds) {
    setState({ loading: def.name })
    say(`Loading ${def.name}…`)
    try {
      const source = await def.load()
      if (source.kind === 'json' && source.rows.length === 0) {
        setState({ loading: null })
        return say(`${def.name} has no rows.`)
      }
      const table = `t_${id.replace(/\W/g, '_')}`
      const columns = await loadTable(table, source, def.epochFields)
      const distinct = await countDistinct(table, columns)
      ds = {
        distinct,
        def,
        table,
        columns,
        timeField: def.timeField ?? columns.find((c) => c.kind === 'time')?.name ?? null,
        geo: def.geo ?? detectGeo(columns),
        labelField: def.labelField ?? columns.find((c) => c.kind === 'text')?.name ?? null,
      }
      setState({ datasets: { ...getState().datasets, [id]: ds } })
    } catch (err) {
      setState({ loading: null })
      console.error(err)
      return say(`Couldn't load ${def.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  setState({ activeId: id, loading: null, spec: { ...EMPTY_SPEC, ...defaultsFor(ds) }, selected: null, hovered: null })
  // No camera flight: the world builds in front of you while you look up at
  // its title (GAZE_RATE, a third of the boxes' easing rate).
  await refresh()
  say(def.blurb)
  const layout = getState().layout
  if (layout) setState({ gaze: { id: ++gazeId, target: titleGaze(layout) } })
}
let gazeId = 0

// Where to look from the start point: toward the title, but pitched lower so
// the title sits near the top of the screen and the skyline fills the middle,
// above the keys panel. (The camera's vertical field of view is 70°.)
const TITLE_ABOVE_CENTER = (22 * Math.PI) / 180
function titleGaze(layout: Layout): Vec3 {
  const { position: [x, y, z], size } = titlePlacement(layout, START_POSITION)
  const [ex, ey, ez] = START_POSITION
  const dx = x - ex, dz = z - ez
  const flat = Math.hypot(dx, dz) || 1
  const pitch = Math.max(Math.atan2(y + size * 0.4 - ey, flat) - TITLE_ABOVE_CENTER, -Math.PI / 6)
  return [x, ey + Math.tan(pitch) * flat, z]
}

// Dropped or uploaded: validate first, so a bad file gets a plain sentence.
export async function addCsv(file: File) {
  const check = await validateCsv(file)
  if (!check.ok) return say(check.error)
  const def = csvDataset(file.name, check.text, { name: file.name, lastModified: file.lastModified, rows: check.rows, columns: check.columns })
  const { defs, datasets } = getState()
  const rest = { ...datasets }
  delete rest[def.id]
  setState({ defs: [...defs.filter((d) => d.id !== def.id), def], datasets: rest })
  return activate(def.id)
}

let querySeq = 0
async function refresh() {
  const { activeId, datasets, spec } = getState()
  const ds = activeId ? datasets[activeId] : null
  if (!ds) return
  const seq = ++querySeq
  const rows = await queryRows(buildQuery(ds, spec))
  if (seq !== querySeq) return // a newer view already replaced this one
  setState({ rows, layout: computeLayout(rows, spec, ds), selected: null })
}

const active = (): Dataset | null => {
  const { activeId, datasets } = getState()
  return activeId ? datasets[activeId] : null
}

function context(): ParseContext {
  const ds = active()
  const { defs, layout, spec } = getState()
  return {
    columns: ds?.columns ?? [],
    fieldAliases: ds?.def.fieldAliases ?? {},
    datasets: defs,
    groups: layout?.groups.map((g) => g.key) ?? [],
    heightField: spec.height,
  }
}

// A few frequent values per text column, so the AI can map what people say
// ("California") onto what the data holds ("CA").
function samples(): Record<string, string[]> {
  const { rows } = getState()
  const out: Record<string, string[]> = {}
  for (const c of active()?.columns ?? []) {
    if (c.kind !== 'text') continue
    const counts = new Map<string, number>()
    for (const r of rows.slice(0, 2000)) {
      const v = r[c.name]
      if (typeof v === 'string' && v) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    out[c.name] = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v.slice(0, 40))
  }
  return out
}

function aiContext(): AiContext {
  const ds = active()!
  const { defs, layout, spec } = getState()
  return {
    dataset: { id: ds.def.id, name: ds.def.name },
    columns: ds.columns.map((c) => ({ name: c.name, kind: c.kind })),
    datasets: defs.map((d) => ({ id: d.id, name: d.name })),
    groups: layout?.groups.map((g) => g.key) ?? [],
    spec,
    samples: samples(),
  }
}

// Free parser first; the AI only sees what the parser couldn't handle.
export async function submit(raw: string) {
  const text = raw.trim()
  if (!text) return
  setState({ heard: text })

  const result = parse(text, context())
  if (result && 'command' in result) {
    await runCommand(result.command)
    return
  }
  if (!active()) return say(result?.error ?? `I don't know "${text}" yet.`)

  say('Thinking…')
  const ai = await askAi(text, aiContext())
  if ('error' in ai) {
    if (result) return say(result.error)
    return say(`I don't know "${text}" yet (${ai.error}). Say "help" to hear what I understand.`)
  }
  let ok = true
  for (const cmd of ai.commands) ok = (await runCommand(cmd)) && ok
  // A rejected command already explained itself; otherwise the AI's reply narrates.
  if (ok && ai.reply) say(ai.reply)
}

const OP_WORDS: Record<Filter['op'], string> = {
  eq: 'is', neq: 'is not', gt: 'above', gte: 'at least', lt: 'below', lte: 'at most', contains: 'contains',
}
export const describeFilter = (f: Filter) => `${f.field} ${OP_WORDS[f.op]} ${f.value}`

async function updateSpec(patch: Partial<ViewSpec>) {
  setState({ spec: { ...getState().spec, ...patch } })
  await refresh()
}

// Validates and applies one command. The AI sends the same shapes, so field
// names and dataset ids are never trusted. Returns false if it was rejected.
export async function runCommand(cmd: Command): Promise<boolean> {
  if (cmd.type === 'dataset' && !getState().defs.some((d) => d.id === cmd.id)) {
    say(`There's no world called "${cmd.id}".`)
    return false
  }
  const ds = active()
  const field =
    cmd.type === 'groupBy' || cmd.type === 'sortBy' || cmd.type === 'encode' ? cmd.field : cmd.type === 'filter' ? cmd.filter.field : null
  if (ds && field !== null && !ds.columns.some((c) => c.name === field)) {
    say(`There's no field called "${field}" in ${ds.def.name}.`)
    return false
  }
  await apply(cmd)
  return true
}

async function apply(cmd: Command) {
  const ds = active()
  if (cmd.type === 'help') return say(HELP)
  if (cmd.type === 'keys') return setState({ keysOpen: cmd.open })
  if (cmd.type === 'dataset') return activate(cmd.id)
  if (!ds) return

  switch (cmd.type) {
    case 'groupBy':
      await updateSpec({ groupBy: cmd.field })
      if (cmd.field) {
        const n = getState().layout?.groups.length ?? 0
        say(`Grouped by ${cmd.field}: ${n} group${n === 1 ? '' : 's'}. Say "go to …" to visit one.`)
      } else say('Ungrouped.')
      return
    case 'sortBy':
      await updateSpec({ sortBy: cmd.field ? { field: cmd.field, dir: cmd.dir } : null })
      return say(cmd.field ? `Sorted by ${cmd.field}, ${cmd.dir === 'desc' ? 'highest' : 'lowest'} first.` : 'Unsorted.')
    case 'filter': {
      const filters = [...getState().spec.filters.filter((f) => f.field !== cmd.filter.field), cmd.filter]
      await updateSpec({ filters })
      const { layout, rows } = getState()
      return say(`${layout?.matches ?? 0} of ${rows.length} have ${filters.map(describeFilter).join(' and ')}. The rest sank.`)
    }
    case 'clearFilters':
      await updateSpec({ filters: [] })
      return say('Filters cleared. Everything is back up.')
    case 'encode':
      await updateSpec(cmd.channel === 'height' ? { height: cmd.field } : { color: cmd.field })
      return say(cmd.field ? `${cmd.channel === 'height' ? 'Height' : 'Color'} now shows ${cmd.field}.` : `${cmd.channel === 'height' ? 'Height' : 'Color'} cleared.`)
    case 'layout':
      await updateSpec({ layout: cmd.mode })
      say(getState().layout?.note ?? `Switched to the ${cmd.mode} layout.`)
      return flyTo('overview')
    case 'flyTo':
      return flyTo(cmd.target)
    case 'clearAll':
      setState({ spec: { ...EMPTY_SPEC, ...defaultsFor(ds) } })
      await refresh()
      return say('Cleared. Back to how it arrived.')
    case 'reset':
      setState({ spec: { ...EMPTY_SPEC, ...defaultsFor(ds) } })
      await refresh()
      say('Back to the default view.')
      return flyTo('overview')
  }
}

let flightId = 0
export function flyTo(target: FlyTarget) {
  if (target === 'home') {
    const { layout } = getState()
    return setState({ flight: { id: ++flightId, position: START_POSITION, lookAt: layout ? titleGaze(layout) : START_LOOK_AT } })
  }
  const { layout, selected } = getState()
  if (!layout) return
  const [x0, , z0] = layout.min
  const [x1, y1, z1] = layout.max
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const extent = Math.max(x1 - x0, z1 - z0, 10)
  let position: Vec3
  let lookAt: Vec3

  if (target === 'overview') {
    position = [cx, Math.max(y1, 0) + extent * 0.45 + 6, z1 + extent * 0.35 + 8]
    lookAt = [cx, 0, cz]
  } else if (target === 'selected') {
    if (selected === null) return say('Nothing is selected. Aim at something and click it first.')
    const o = selected * 3
    const [x, y, z] = [layout.pos[o], layout.pos[o + 1], layout.pos[o + 2]]
    const h = layout.size[o + 1]
    position = [x + 2, y + h + 2, z + 4]
    lookAt = [x, y + h / 2, z]
  } else {
    const g = layout.groups.find((g) => g.key === target.group)
    if (!g) return say(`There's no group called "${target.group}" right now.`)
    const [gx, , gz] = g.center
    position = [gx, g.top + 3 + g.width * 0.3, gz + g.width * 0.7 + 5]
    lookAt = [gx, g.top * 0.4, gz]
    say(`${g.key}: ${g.count} record${g.count === 1 ? '' : 's'}.`)
  }
  setState({ flight: { id: ++flightId, position, lookAt } })
}

