import type { Filter, LayoutMode } from './commands/types'

export type ColumnKind = 'number' | 'text' | 'time' | 'bool'

export interface Column {
  name: string
  kind: ColumnKind
  sqlType: string
}

// Rows come back from DuckDB with numbers as doubles and times as epoch ms.
export type Value = string | number | boolean | null
export type Row = Record<string, Value>

export interface ViewSpec {
  layout: LayoutMode
  groupBy: string | null
  sortBy: { field: string; dir: 'asc' | 'desc' } | null
  filters: Filter[]
  height: string | null
  color: string | null
}

export type DataSource = { kind: 'json'; rows: Row[] } | { kind: 'csv'; text: string }

export interface GeoFields {
  lat: string
  lon: string
  depth?: string
}

export interface DatasetDef {
  id: string
  name: string
  // What the narrator says when you arrive. This is the editorial voice.
  blurb: string
  // Spoken names for the dataset: "sales", "the sales data".
  aliases: string[]
  // Spoken names for fields: { qty: ['quantity'] }.
  fieldAliases?: Record<string, string[]>
  // Numeric epoch-ms columns that should be treated as time.
  epochFields?: string[]
  timeField?: string
  geo?: GeoFields
  labelField?: string
  defaults: Partial<ViewSpec>
  load: () => Promise<DataSource>
}

export interface Dataset {
  def: DatasetDef
  table: string
  columns: Column[]
  timeField: string | null
  geo: GeoFields | null
  labelField: string | null
}
