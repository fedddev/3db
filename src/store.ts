import { create } from 'zustand'
import type { Layout } from './scene/layout'
import type { Dataset, DatasetDef, Row, ViewSpec } from './types'

export type Vec3 = [number, number, number]

// Where you stand on load and after "recenter": eye height, 10 m from the center.
export const EYE_HEIGHT = 1.6
export const START_POSITION: Vec3 = [0, EYE_HEIGHT, 10]
export const START_LOOK_AT: Vec3 = [0, 0, 0]

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
  // Bumped on every new message, so the same words said twice still show again.
  messageId: number
  heard: string
  interim: string
  listening: boolean
  locked: boolean
  flight: Flight | null
  // The keys panel starts collapsed so it doesn't cover the world.
  keysOpen: boolean
  // A camera turn in place (e.g. up to a new world's title), eased like the boxes.
  gaze: { id: number; target: Vec3 } | null
}

export const EMPTY_SPEC: ViewSpec = {
  layout: 'grid',
  groupBy: null,
  sortBy: null,
  filters: [],
  height: null,
  color: null,
}

export const say = (message: string) => useStore.setState((s) => ({ message, messageId: s.messageId + 1 }))

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
  message: 'Welcome to 3db. Drop a CSV anywhere, or upload one, to turn it into a world.',
  messageId: 0,
  heard: '',
  interim: '',
  listening: false,
  locked: false,
  flight: null,
  keysOpen: false,
  gaze: null,
}))

export const getState = useStore.getState
export const setState = useStore.setState
