// The free fast path: turns common phrases into Commands without any network
// call. Anything it can't handle returns null, which is where the AI takes over.

import type { Column, DatasetDef } from '../types'
import type { Command, FilterOp, LayoutMode } from './types'

export interface ParseContext {
  columns: Column[]
  fieldAliases: Record<string, string[]>
  datasets: DatasetDef[]
  groups: string[]
  heightField: string | null
}

export type ParseResult = { command: Command } | { error: string } | null

const ok = (command: Command): ParseResult => ({ command })

// Lowercase, drop punctuation (but keep decimal points), collapse whitespace.
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\.(?!\d)/g, ' ')
    .replace(/[^a-z0-9.\s<>=-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const stripArticles = (s: string) => s.replace(/^(the|a|an|its|their|by) /, '').trim()

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
}

// Speech recognition says "4.5" most of the time, but sometimes "four point five".
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/,/g, '')
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  let total = 0, current = 0, fraction = '', inFraction = false, any = false
  for (const w of t.split(' ')) {
    if (w === 'and' || !w) continue
    if (w === 'point') {
      inFraction = true
      continue
    }
    const v = NUMBER_WORDS[w] ?? (/^\d$/.test(w) ? Number(w) : undefined)
    if (v === undefined) return null
    any = true
    if (inFraction) {
      if (v > 9) return null
      fraction += v
    } else if (v === 100) current = (current || 1) * 100
    else if (v === 1000) {
      total += (current || 1) * 1000
      current = 0
    } else current += v
  }
  if (!any) return null
  const whole = total + current
  return fraction ? Number(`${whole}.${fraction}`) : whole
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

export function resolveField(phrase: string, ctx: ParseContext): string | null {
  const p = compact(stripArticles(phrase))
  if (!p) return null
  const names = ctx.columns.map((c) => c.name)
  const exact = names.find((n) => compact(n) === p)
  if (exact) return exact
  for (const [field, aliases] of Object.entries(ctx.fieldAliases)) {
    if (names.includes(field) && aliases.some((a) => compact(a) === p)) return field
  }
  const loose = names.find((n) => {
    const c = compact(n)
    return c === p.replace(/s$/, '') || (c.length >= 3 && p.startsWith(c)) || (p.length >= 3 && c.startsWith(p))
  })
  if (loose) return loose
  let best: string | null = null
  let bestDistance = Math.max(1, Math.floor(p.length / 4)) + 1
  for (const n of names) {
    const d = levenshtein(compact(n), p)
    if (d < bestDistance) {
      best = n
      bestDistance = d
    }
  }
  return best
}

function resolveDataset(phrase: string, ctx: ParseContext): string | null {
  const p = compact(stripArticles(phrase.replace(/ (data ?set|data|world)$/, '')))
  return ctx.datasets.find((d) => [d.id, d.name, ...d.aliases].some((a) => compact(a) === p))?.id ?? null
}

function resolveGroup(phrase: string, ctx: ParseContext): string | null {
  const p = compact(stripArticles(phrase.replace(/ (group|district|cluster|lane)$/, '')))
  if (!p) return null
  return (
    ctx.groups.find((g) => compact(g) === p) ??
    ctx.groups.find((g) => compact(g).length >= 3 && (compact(g).startsWith(p) || p.startsWith(compact(g)))) ??
    null
  )
}

function unknownField(phrase: string, ctx: ParseContext): ParseResult {
  const list = ctx.columns.map((c) => c.name).join(', ')
  return { error: `There's no field called "${stripArticles(phrase)}" here. Fields: ${list}.` }
}

const LAYOUTS: Record<string, LayoutMode> = {
  grid: 'grid', blocks: 'grid', city: 'grid',
  timeline: 'timeline', 'time line': 'timeline', time: 'timeline',
  geo: 'geo', map: 'geo', globe: 'geo', 'world map': 'geo',
}

// Longest phrases first so "is greater than" wins over "is".
const OPERATORS: [string, FilterOp][] = [
  ['is not equal to', 'neq'], ['not equal to', 'neq'], ['is not', 'neq'], ['isn t', 'neq'], ['!=', 'neq'],
  ['is at least', 'gte'], ['at least', 'gte'], ['>=', 'gte'],
  ['is at most', 'lte'], ['at most', 'lte'], ['<=', 'lte'],
  ['is greater than', 'gt'], ['greater than', 'gt'], ['is more than', 'gt'], ['more than', 'gt'],
  ['bigger than', 'gt'], ['larger than', 'gt'], ['higher than', 'gt'], ['deeper than', 'gt'],
  ['is above', 'gt'], ['above', 'gt'], ['over', 'gt'], ['>', 'gt'],
  ['is less than', 'lt'], ['less than', 'lt'], ['fewer than', 'lt'], ['smaller than', 'lt'],
  ['lower than', 'lt'], ['shallower than', 'lt'], ['is below', 'lt'], ['below', 'lt'], ['under', 'lt'], ['<', 'lt'],
  ['is equal to', 'eq'], ['equal to', 'eq'], ['equals', 'eq'], ['is', 'eq'], ['=', 'eq'],
  ['contains', 'contains'], ['containing', 'contains'], ['includes', 'contains'], ['including', 'contains'], ['mentions', 'contains'], ['mentioning', 'contains'],
]
const OPERATOR_RE = OPERATORS.map(([w]) => w.replace(/[<>=!]/g, (c) => `\\${c}`)).join('|')
const FILTER_RE = new RegExp(
  `^(?:filter(?: to| for| by)?|show(?: me)?(?: only)?|only(?: show)?|keep(?: only)?|where|just)(?: the)?(?: ones?| those| records| rows| items)?(?: where| with| whose| that are| that have)? (.+?) (${OPERATOR_RE}) (.+)$`,
)
// "show the ones over 5": no field named, so it means whatever height shows.
const IMPLICIT_FILTER_RE = /^(?:show|only|filter|keep|just)(?: me)?(?: only)?(?: the)?(?: \w+)? (over|above|bigger than|larger than|greater than|more than|under|below|less than|smaller than) (.+)$/

export function parse(input: string, ctx: ParseContext): ParseResult {
  const t = normalize(input)
    .replace(/^((please|can you|could you|let s|lets|now|ok|okay|hey|and|then|3db|three db) )+/, '')
    .replace(/ (please|now|for me)$/, '')
  let m: RegExpMatchArray | null

  if (/^(help|what can i (say|do)|commands|options|what do you understand)$/.test(t)) return ok({ type: 'help' })
  if (/^(reset|start over|reset (the )?view|default view)$/.test(t)) return ok({ type: 'reset' })
  if (/^((clear|remove|reset|drop)( all)?( the)? filters?|show (me )?(everything|all)|unfilter|no filters?)$/.test(t))
    return ok({ type: 'clearFilters' })
  if (/^(ungroup|no group(ing)?|stop grouping|remove (the )?grouping|don t group)$/.test(t)) return ok({ type: 'groupBy', field: null })
  if (/^(unsort|no sort(ing)?|stop sorting|remove (the )?sort(ing)?)$/.test(t)) return ok({ type: 'sortBy', field: null, dir: 'asc' })
  if (/^(no colou?rs?|remove (the )?colou?rs?|stop colou?ring|one colou?r)$/.test(t)) return ok({ type: 'encode', channel: 'color', field: null })
  if (/^(flat(ten)?( it| everything)?|no height|remove (the )?height|same height)$/.test(t)) return ok({ type: 'encode', channel: 'height', field: null })

  if ((m = t.match(/^(?:group|cluster|split|organi[sz]e|bucket)(?: them| it| everything| the data| these)? by (.+)$/))) {
    const field = resolveField(m[1], ctx)
    return field ? ok({ type: 'groupBy', field }) : unknownField(m[1], ctx)
  }

  if ((m = t.match(/^(?:sort|order|rank)(?: them| it| everything| these)? by (.+?)(?: (ascending|asc|descending|desc|highest first|lowest first|biggest first|smallest first|largest first|oldest first|newest first|high to low|low to high))?$/))) {
    const field = resolveField(m[1], ctx)
    if (!field) return unknownField(m[1], ctx)
    const kind = ctx.columns.find((c) => c.name === field)?.kind
    const dir = m[2]
      ? /asc|lowest|smallest|oldest|low to high/.test(m[2]) ? 'asc' : 'desc'
      : kind === 'number' ? 'desc' : 'asc'
    return ok({ type: 'sortBy', field, dir })
  }

  if ((m = t.match(/^(biggest|largest|tallest|highest|strongest|smallest|shortest|lowest|weakest) first$/))) {
    if (!ctx.heightField) return { error: 'Nothing is mapped to height yet. Try "height by …" first.' }
    return ok({ type: 'sortBy', field: ctx.heightField, dir: /small|short|low|weak/.test(m[1]) ? 'asc' : 'desc' })
  }

  if ((m = t.match(/^(?:colou?r|paint|shade|tint)(?: them| it| everything| these)? (?:by|with|using) (.+)$/))) {
    const field = resolveField(m[1], ctx)
    return field ? ok({ type: 'encode', channel: 'color', field }) : unknownField(m[1], ctx)
  }

  if ((m = t.match(/^(?:(?:make )?(?:the )?height|heights|size|scale|raise them|stack them)(?: them| it)? (?:by|to|from|shows?|as|represent|equal|using) (.+)$/))) {
    const field = resolveField(m[1], ctx)
    return field ? ok({ type: 'encode', channel: 'height', field }) : unknownField(m[1], ctx)
  }

  if ((m = t.match(/^(?:(?:switch|change|go|flip)(?: back)?(?: to)? )?(?:(?:layout|arrange|view|show|lay it out)(?: it)?(?: as| in| on)? )?(?:(?:the|a) )?(grid|blocks|city|timeline|time line|time|geo|map|globe|world map)(?: view| layout| mode)?$/))) {
    return ok({ type: 'layout', mode: LAYOUTS[m[1]] })
  }

  if (/\b(overview|bird s eye|birds eye|zoom out|top view|big picture|go up high)\b/.test(t)) return ok({ type: 'flyTo', target: 'overview' })
  if (/^((go|fly|take me) )?(home|back to (the )?start)$/.test(t)) return ok({ type: 'flyTo', target: 'home' })
  if (/^(go|fly|take me|zoom) (in )?(to )?(it|there|that( one)?|the selection|selected|this one)$/.test(t)) return ok({ type: 'flyTo', target: 'selected' })

  if ((m = t.match(/^(?:show(?: me)?|open|load|switch to|bring up|let me see|explore|visit)? ?(.+)$/))) {
    const id = resolveDataset(m[1], ctx)
    if (id) return ok({ type: 'dataset', id })
  }

  if ((m = t.match(/^(?:go|fly|take me|jump|head|zoom)(?: over| in)? to (.+)$/))) {
    const id = resolveDataset(m[1], ctx)
    if (id) return ok({ type: 'dataset', id })
    const group = resolveGroup(m[1], ctx)
    if (group) return ok({ type: 'flyTo', target: { group } })
    return ctx.groups.length
      ? { error: `I can't find "${m[1]}". Groups here include: ${ctx.groups.slice(0, 8).join(', ')}.` }
      : { error: `I can't find "${m[1]}". Try "group by …" first, then fly to a group.` }
  }

  if ((m = t.match(FILTER_RE))) {
    const field = resolveField(m[1], ctx)
    const op = OPERATORS.find(([w]) => w === m![2])![1]
    const raw = m[3].replace(/^(the |a )/, '').replace(/ only$/, '').trim()
    if (field) {
      const kind = ctx.columns.find((c) => c.name === field)!.kind
      if (kind === 'number') {
        const value = parseNumber(raw)
        if (value === null) return { error: `"${raw}" isn't a number I understand.` }
        return ok({ type: 'filter', filter: { field, op: op === 'contains' ? 'eq' : op, value } })
      }
      if (kind === 'time') return null // "after last Tuesday" is AI territory
      return ok({ type: 'filter', filter: { field, op, value: raw } })
    }
  }

  if ((m = t.match(IMPLICIT_FILTER_RE)) && ctx.heightField) {
    const value = parseNumber(m[2])
    if (value !== null) {
      const op: FilterOp = /under|below|less|smaller/.test(m[1]) ? 'lt' : 'gt'
      return ok({ type: 'filter', filter: { field: ctx.heightField, op, value } })
    }
  }

  return null
}

export const HELP =
  'Try: "group by <column>" · "sort by <column>" · "color by <column>" · "height by <column>" · "only <column> above 10" · "clear filters" · "timeline" / "map" / "grid" · "overview" · "go to <group>" · "reset"'
