import type { Filter } from '../commands/types'
import type { Column, Dataset, ViewSpec } from '../types'
import { quoteIdent as q, quoteString } from './duckdb'

export const ROW_LIMIT = 5000
// Filters don't remove rows: every row comes back with a match flag, so the
// ones that don't match can sink in place instead of vanishing.
export const MATCH = '__match'

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' } as const

// Normalizes every column to something the scene can use directly:
// numbers as doubles, times as epoch ms, everything exotic as text.
function selectExpr(c: Column, isEpoch: boolean) {
  const id = q(c.name)
  if (c.kind === 'number' || (c.kind === 'time' && isEpoch)) return `CAST(${id} AS DOUBLE) AS ${id}`
  if (c.kind === 'time') return `CAST(epoch_ms(CAST(${id} AS TIMESTAMP)) AS DOUBLE) AS ${id}`
  if (c.kind === 'bool') return id
  return `CAST(${id} AS VARCHAR) AS ${id}`
}

function predicate(f: Filter, columns: Column[]): string {
  const col = columns.find((c) => c.name === f.field)
  if (!col) return 'TRUE'
  const id = q(col.name)
  if (col.kind === 'number' || col.kind === 'time') {
    const n = Number(f.value)
    if (!Number.isFinite(n) || f.op === 'contains') return 'FALSE'
    return `${id} ${OPS[f.op]} ${n}`
  }
  const text = `lower(CAST(${id} AS VARCHAR))`
  const value = quoteString(String(f.value).toLowerCase())
  if (f.op === 'contains') return `contains(${text}, ${value})`
  return `${text} ${OPS[f.op]} ${value}`
}

export function buildQuery(ds: Dataset, spec: ViewSpec) {
  const epoch = new Set(ds.def.epochFields ?? [])
  const cols = ds.columns.map((c) => selectExpr(c, epoch.has(c.name)))
  const match = spec.filters.length ? spec.filters.map((f) => predicate(f, ds.columns)).join(' AND ') : 'TRUE'
  const sort = spec.sortBy ?? (ds.timeField ? { field: ds.timeField, dir: 'asc' as const } : null)
  const order =
    sort && ds.columns.some((c) => c.name === sort.field)
      ? ` ORDER BY ${q(sort.field)} ${sort.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`
      : ''
  return `SELECT ${cols.join(', ')}, COALESCE(${match}, FALSE) AS ${MATCH} FROM ${q(ds.table)}${order} LIMIT ${ROW_LIMIT}`
}
