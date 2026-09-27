// Checks a file is a well-formed CSV before it becomes a world, so problems
// come back as a plain sentence instead of a DuckDB error.

const MAX_BYTES = 50 * 1024 * 1024
const DELIMITERS = [',', ';', '\t', '|']

export type CsvCheck =
  | { ok: true; text: string; rows: number; columns: number }
  | { ok: false; error: string }

export async function validateCsv(file: File): Promise<CsvCheck> {
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    const ext = file.name.match(/\.[^.]+$/)?.[0]
    return { ok: false, error: `"${file.name}" isn't a CSV${ext ? ` (it's a ${ext} file)` : ''}. 3db reads .csv files.` }
  }
  if (file.size === 0) return { ok: false, error: `"${file.name}" is empty.` }
  if (file.size > MAX_BYTES) return { ok: false, error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB. 3db takes CSVs up to 50 MB.` }

  const text = (await file.text()).replace(/^﻿/, '')
  const firstLine = text.slice(0, text.search(/\r?\n|$/))
  const delimiter = DELIMITERS.reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',')

  const records = splitRecords(text, delimiter)
  if ('error' in records) return { ok: false, error: `"${file.name}": ${records.error}` }
  const [header, ...rows] = records.rows
  if (!header) return { ok: false, error: `"${file.name}" is empty.` }

  const names = header.map((h) => h.trim())
  const blank = names.findIndex((h) => !h)
  if (blank >= 0) return { ok: false, error: `"${file.name}": column ${blank + 1} has no name in the header row.` }
  const dupe = names.find((h, i) => names.indexOf(h) !== i)
  if (dupe) return { ok: false, error: `"${file.name}": the header has two columns called "${dupe}".` }
  if (!rows.length) return { ok: false, error: `"${file.name}" has a header but no rows.` }

  const bad = rows.findIndex((r) => r.length !== header.length)
  if (bad >= 0) {
    return {
      ok: false,
      error: `"${file.name}": row ${bad + 2} has ${rows[bad].length} values, but the header has ${header.length} columns.`,
    }
  }
  return { ok: true, text, rows: rows.length, columns: header.length }
}

// RFC 4180-style: quoted fields may hold delimiters, newlines and "" escapes.
// Blank lines are skipped.
function splitRecords(text: string, delimiter: string): { rows: string[][] } | { error: string } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let quoteStart = 0
  const endRow = () => {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
    field = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === '\n') line++
        field += ch
      }
    } else if (ch === '"' && field === '') {
      quoted = true
      quoteStart = line
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
      line++
    } else field += ch
  }
  if (quoted) return { error: `a quote opened on line ${quoteStart} is never closed.` }
  if (field !== '' || row.length) endRow()
  return { rows }
}
