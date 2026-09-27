import { create } from 'zustand'
import type { Layout } from './scene/layout'
import type { Dataset, DatasetDef, Row, ViewSpec } from './types'

export type Vec3 = [number, number, number]

export interface Flight {
  id: number
  position: Vec3
  lookAt: Vec3
}

interface State {
  phase: 'booting' | 'ready' | 'error'
  defs: DatasetDef[]
  datasets: Record<string, Dataset>
  activeId: string | null
  loading: string | null
  spec: ViewSpec
  rows: Row[]
  layout: Layout | null
  selected: number | null
  hovered: number | null
  // The narrator line, the heir of the 2018 tutorial console.
  message: string
  heard: string
  interim: string
  listening: boolean
  locked: boolean
  flight: Flight | null
}

export const EMPTY_SPEC: ViewSpec = {
  layout: 'grid',
  groupBy: null,
  sortBy: null,
  filters: [],
  height: null,
  color: null,
}

export const useStore = create<State>(() => ({
  phase: 'booting',
  defs: [],
  datasets: {},
  activeId: null,
  loading: null,
  spec: EMPTY_SPEC,
  rows: [],
  layout: null,
  selected: null,
  hovered: null,
  message: 'Welcome to 3db. Drop a CSV anywhere to turn it into a world.',
  heard: '',
  interim: '',
  listening: false,
  locked: false,
  flight: null,
}))

export const getState = useStore.getState
export const setState = useStore.setState
