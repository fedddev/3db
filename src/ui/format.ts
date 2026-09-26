import type { Column, Value } from '../types'

export function formatValue(v: Value, col?: Column) {
  if (v === null || v === undefined || v === '') return '—'
  if (col?.kind === 'time' && typeof v === 'number') return new Date(v).toLocaleString()
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 3 })
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return v
}
