import { BUILT_IN, csvDataset } from '../data/datasets'
import { loadTable, queryRows } from '../data/duckdb'
import { buildQuery } from '../data/query'
import { computeLayout } from '../scene/layout'
import { EMPTY_SPEC, getState, setState, type Vec3 } from '../store'
import type { Column, Dataset, GeoFields, ViewSpec } from '../types'
import { appendLog } from './log'
import { HELP, parse, type ParseContext } from './parse'
import type { Command, Filter, FlyTarget } from './types'

const say = (message: string) => setState({ message })

let booted = false
export async function boot() {
  if (booted) return
  booted = true
  await activate(BUILT_IN[0].id)
  setState({ phase: getState().activeId ? 'ready' : 'error' })
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
  const height = ds.columns.find((c) => c.kind === 'number' && !skip.has(c.name))?.name ?? null
  return { layout: ds.geo ? 'geo' : ds.timeField ? 'timeline' : 'grid', height }
}

export async function activate(id: string) {
  const def = getState().defs.find((d) => d.id === id)
  if (!def) return say(`There's no world called "${id}".`)
  let ds = getState().datasets[id]
  if (!ds || def.volatile) {
    setState({ loading: def.name, message: `Loading ${def.name}…` })
    try {
      const source = await def.load()
      if (source.kind === 'json' && source.rows.length === 0) {
        setState({ loading: null })
        return say(`${def.name} is empty so far. Say or type a few commands first.`)
      }
      const table = `t_${id.replace(/\W/g, '_')}`
      const columns = await loadTable(table, source, def.epochFields)
      ds = {
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
  await refresh()
  say(def.blurb)
  flyTo('overview')
}

export function addCsv(fileName: string, text: string) {
  const def = csvDataset(fileName, text)
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

export async function submit(raw: string, source: 'voice' | 'typed') {
  const text = raw.trim()
  if (!text) return
  setState({ heard: text })
  const result = parse(text, context())
  const command = result && 'command' in result ? result.command : null
  appendLog({ at: Date.now(), text, source, understood: !!command, command: command?.type ?? '' })
  if (!result) return say(`I don't know "${text}" yet. Say "help" to hear what I understand.`)
  if ('error' in result) return say(result.error)
  await runCommand(result.command)
}

const OP_WORDS: Record<Filter['op'], string> = {
  eq: 'is', neq: 'is not', gt: 'above', gte: 'at least', lt: 'below', lte: 'at most', contains: 'contains',
}
const describeFilter = (f: Filter) => `${f.field} ${OP_WORDS[f.op]} ${f.value}`

async function updateSpec(patch: Partial<ViewSpec>) {
  setState({ spec: { ...getState().spec, ...patch } })
  await refresh()
}

// Validates and applies one command. The AI will call this with the same
// shapes, so it must never trust field names.
export async function runCommand(cmd: Command) {
  const ds = active()
  if (cmd.type === 'help') return say(HELP)
  if (cmd.type === 'dataset') return activate(cmd.id)
  if (!ds) return

  const hasField = (f: string | null) => f === null || ds.columns.some((c) => c.name === f)
  const fieldOf = (c: Command) =>
    c.type === 'groupBy' || c.type === 'sortBy' || c.type === 'encode' ? c.field : c.type === 'filter' ? c.filter.field : null
  const field = fieldOf(cmd)
  if (!hasField(field)) return say(`There's no field called "${field}" in ${ds.def.name}.`)

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
    case 'reset':
      setState({ spec: { ...EMPTY_SPEC, ...defaultsFor(ds) } })
      await refresh()
      say('Back to the default view.')
      return flyTo('overview')
  }
}

let flightId = 0
export function flyTo(target: FlyTarget) {
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
  } else if (target === 'home') {
    position = [cx, 2, z1 + 8]
    lookAt = [cx, 1.5, cz]
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

