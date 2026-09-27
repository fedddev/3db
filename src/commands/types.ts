// The command vocabulary: the only way anything changes the world.
// The in-browser parser emits these today; the AI proxy will emit the same
// shapes as structured output. Keep them small, flat, and serializable.

export type LayoutMode = 'grid' | 'timeline' | 'geo'
export type Channel = 'height' | 'color'
export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export interface Filter {
  field: string
  op: FilterOp
  value: string | number
}

export type FlyTarget = 'overview' | 'home' | 'selected' | { group: string }

export type Command =
  | { type: 'dataset'; id: string }
  | { type: 'groupBy'; field: string | null }
  | { type: 'sortBy'; field: string | null; dir: 'asc' | 'desc' }
  | { type: 'filter'; filter: Filter }
  | { type: 'clearFilters' }
  | { type: 'encode'; channel: Channel; field: string | null }
  | { type: 'layout'; mode: LayoutMode }
  | { type: 'flyTo'; target: FlyTarget }
  | { type: 'reset' }
  | { type: 'help' }
  | { type: 'keys'; open: boolean }
