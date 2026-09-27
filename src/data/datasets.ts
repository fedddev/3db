import type { DatasetDef } from '../types'

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
