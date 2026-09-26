import * as duckdb from '@duckdb/duckdb-wasm'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import type { Column, ColumnKind, DataSource, Row, Value } from '../types'

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

function getDb() {
  dbPromise ??= (async () => {
    const bundle = await duckdb.selectBundle(BUNDLES)
    const worker = new Worker(bundle.mainWorker!)
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    return db
  })()
  return dbPromise
}

export const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`
export const quoteString = (s: string) => `'${s.replaceAll("'", "''")}'`

function kindOf(sqlType: string): ColumnKind {
  const t = sqlType.toUpperCase()
  if (t === 'BOOLEAN') return 'bool'
  if (t === 'DATE' || t.startsWith('TIMESTAMP')) return 'time'
  if (/^(U?(TINY|SMALL|BIG|HUGE)?INT(EGER)?|DOUBLE|FLOAT|REAL|DECIMAL.*)$/.test(t)) return 'number'
  return 'text'
}

// Loads a dataset into a DuckDB table and returns its columns.
export async function loadTable(table: string, source: DataSource, epochFields: string[] = []): Promise<Column[]> {
  const db = await getDb()
  const file = `${table}.${source.kind}`
  await db.registerFileText(file, source.kind === 'json' ? JSON.stringify(source.rows) : source.text)
  const reader = source.kind === 'json' ? 'read_json_auto' : 'read_csv_auto'
  const conn = await db.connect()
  try {
    await conn.query(`CREATE OR REPLACE TABLE ${quoteIdent(table)} AS SELECT * FROM ${reader}(${quoteString(file)})`)
    const described = await conn.query(`DESCRIBE ${quoteIdent(table)}`)
    return described.toArray().map((r) => {
      const { column_name, column_type } = r.toJSON() as { column_name: string; column_type: string }
      const kind = epochFields.includes(column_name) ? 'time' : kindOf(column_type)
      return { name: column_name, kind, sqlType: column_type }
    })
  } finally {
    await conn.close()
  }
}

export async function queryRows(sql: string): Promise<Row[]> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    const result = await conn.query(sql)
    return result.toArray().map((r) => normalize(r.toJSON()))
  } finally {
    await conn.close()
  }
}

function normalize(obj: Record<string, unknown>): Row {
  const row: Row = {}
  for (const [k, v] of Object.entries(obj)) {
    row[k] = typeof v === 'bigint' ? Number(v) : ((v as Value) ?? null)
  }
  return row
}
