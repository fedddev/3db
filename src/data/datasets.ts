import { readLog } from '../commands/log'
import type { DatasetDef, Row } from '../types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

const commits: DatasetDef = {
  id: 'commits',
  name: '3db build history',
  blurb:
    "You're standing in 3db's own history: every commit since the 2018 original. Time runs away from you, height is lines changed, and color is which repo. It grows every time we push.",
  aliases: ['commits', 'history', 'build history', 'git', 'project', 'the project'],
  fieldAliases: {
    churn: ['lines', 'lines changed', 'changes', 'size'],
    files: ['files changed'],
    ai_assisted: ['ai', 'claude', 'assisted'],
    repo: ['repository', 'era'],
    date: ['time', 'when'],
    message: ['description', 'commit message'],
  },
  epochFields: ['date'],
  timeField: 'date',
  labelField: 'message',
  defaults: { layout: 'timeline', height: 'churn', color: 'repo' },
  load: async () => ({ kind: 'json', rows: await fetchJson<Row[]>('/data/commits.json') }),
}

interface QuakeFeed {
  features: {
    properties: {
      mag: number | null
      place: string | null
      time: number
      sig: number
      tsunami: number
      type: string
      magType: string
    }
    geometry: { coordinates: [number, number, number] }
  }[]
}

// "10 km NW of Anza, CA" -> "CA"; "Fiji region" stays as it is.
const regionOf = (place: string | null) => place?.split(', ').at(-1)?.trim() ?? null

const earthquakes: DatasetDef = {
  id: 'earthquakes',
  name: 'Earthquakes · past 7 days',
  blurb:
    'Every earthquake recorded on Earth this past week, live from USGS. Each one hangs at its true depth below the floor. Press C to sink under it, and watch the plate boundaries draw themselves.',
  aliases: ['earthquakes', 'earthquake', 'quakes', 'seismic', 'usgs'],
  fieldAliases: {
    mag: ['magnitude', 'strength', 'size'],
    depth: ['deep', 'deepness'],
    sig: ['significance'],
    region: ['place', 'location', 'area', 'country', 'state'],
    mag_type: ['magnitude type'],
    time: ['when', 'date'],
  },
  epochFields: ['time'],
  timeField: 'time',
  geo: { lat: 'lat', lon: 'lon', depth: 'depth' },
  labelField: 'place',
  defaults: { layout: 'geo', height: 'mag', color: 'depth' },
  load: async () => {
    const feed = await fetchJson<QuakeFeed>(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
    )
    const rows: Row[] = feed.features.map(({ properties: p, geometry: g }) => ({
      mag: p.mag,
      place: p.place,
      region: regionOf(p.place),
      time: p.time,
      depth: g.coordinates[2],
      lat: g.coordinates[1],
      lon: g.coordinates[0],
      type: p.type,
      sig: p.sig,
      tsunami: p.tsunami === 1,
      mag_type: p.magType,
    }))
    return { kind: 'json', rows }
  },
}

const commandLog: DatasetDef = {
  id: 'commands',
  name: 'Everything you said to 3db',
  blurb:
    "Every command you've spoken or typed in this browser. The dim ones are what I couldn't understand yet: the AI's to-do list.",
  aliases: ['command log', 'commands', 'log', 'voice log', 'what i said', 'my commands'],
  fieldAliases: {
    understood: ['handled', 'parsed', 'recognized'],
    source: ['input', 'voice or typed'],
    at: ['time', 'when', 'date'],
    words: ['length'],
  },
  epochFields: ['at'],
  timeField: 'at',
  labelField: 'text',
  volatile: true,
  defaults: { layout: 'timeline', height: 'words', color: 'understood' },
  load: async () => ({
    kind: 'json',
    rows: readLog().map((e) => ({ ...e, words: e.text.split(/\s+/).length })),
  }),
}

export const BUILT_IN: DatasetDef[] = [commits, earthquakes, commandLog]

export function csvDataset(fileName: string, text: string): DatasetDef {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base.toLowerCase().replace(/[_-]+/g, ' ').trim()
  return {
    id: `csv_${words.replace(/\W+/g, '_')}`,
    name: base,
    blurb: `Your file "${fileName}". Every row is an object. Try "group by", "color by", or "height by" a column.`,
    aliases: [words],
    defaults: {},
    load: async () => ({ kind: 'csv', text }),
  }
}
