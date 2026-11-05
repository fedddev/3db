import type { DatasetDef } from '../types'

export function csvDataset(fileName: string, text: string, file?: DatasetDef['file'], blurb?: string): DatasetDef {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base.toLowerCase().replace(/[_-]+/g, ' ').trim()
  return {
    id: `csv_${words.replace(/\W+/g, '_')}`,
    name: base,
    blurb: blurb ?? `Your file "${fileName}". Every row is an object. Try "group by", "color by", or "height by" a column.`,
    file,
    aliases: [words],
    defaults: {},
    load: async () => ({ kind: 'csv', text }),
  }
}
