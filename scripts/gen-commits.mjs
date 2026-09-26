#!/usr/bin/env node
// Turns git history into the "commits" dataset.
//
//   node scripts/gen-commits.mjs
//     Reads this repo's history live, merges the snapshots in data/lineage/,
//     and writes public/data/commits.json (runs automatically before dev/build).
//
//   node scripts/gen-commits.mjs --snapshot <repo path> --name <name>
//     Freezes another repo's history into data/lineage/<name>.json.
//     Used once for the 2018 threedb-v2 app that 3db grew out of.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LINEAGE_DIR = 'data/lineage'
const OUT = 'public/data/commits.json'
// Generated files would drown out the real work in the line counts.
const NOISE = [/(^|\/)package-lock\.json$/, /^dist\//]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const git = (repo, args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })

function readCommits(repo, name) {
  let meta
  try {
    meta = git(repo, ['log', '--format=%H%x1f%an%x1f%aI%x1f%s%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x2c)%x1e'])
  } catch {
    return [] // no commits yet
  }

  const stats = new Map()
  let current = null
  for (const line of git(repo, ['log', '--numstat', '--format=@@%H']).split('\n')) {
    if (line.startsWith('@@')) {
      current = { files: 0, insertions: 0, deletions: 0 }
      stats.set(line.slice(2), current)
      continue
    }
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m || !current) continue
    current.files++
    if (NOISE.some((r) => r.test(m[3]))) continue
    current.insertions += m[1] === '-' ? 0 : Number(m[1])
    current.deletions += m[2] === '-' ? 0 : Number(m[2])
  }

  return meta
    .split('\x1e')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, author, iso, message, coauthors] = record.split('\x1f')
      const s = stats.get(hash) ?? { files: 0, insertions: 0, deletions: 0 }
      // Hour and weekday in the author's own timezone, as written in the ISO offset.
      const [y, mo, d] = iso.slice(0, 10).split('-').map(Number)
      return {
        hash: hash.slice(0, 7),
        repo: name,
        date: Date.parse(iso),
        message,
        author,
        files: s.files,
        insertions: s.insertions,
        deletions: s.deletions,
        churn: s.insertions + s.deletions,
        hour: Number(iso.slice(11, 13)),
        weekday: WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()],
        ai_assisted: /claude/i.test(coauthors ?? ''),
      }
    })
}

const args = process.argv.slice(2)
const opt = (flag) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

const snapshot = opt('--snapshot')
if (snapshot) {
  const name = opt('--name')
  if (!name) throw new Error('--snapshot needs --name')
  const rows = readCommits(snapshot, name)
  mkdirSync(LINEAGE_DIR, { recursive: true })
  writeFileSync(join(LINEAGE_DIR, `${name}.json`), JSON.stringify(rows, null, 1) + '\n')
  console.log(`snapshot: ${rows.length} commits from ${snapshot} -> ${LINEAGE_DIR}/${name}.json`)
} else {
  const lineage = existsSync(LINEAGE_DIR)
    ? readdirSync(LINEAGE_DIR)
        .filter((f) => f.endsWith('.json'))
        .flatMap((f) => JSON.parse(readFileSync(join(LINEAGE_DIR, f), 'utf8')))
    : []
  const rows = [...lineage, ...readCommits('.', '3db')].sort((a, b) => a.date - b.date)
  mkdirSync('public/data', { recursive: true })
  writeFileSync(OUT, JSON.stringify(rows))
  console.log(`commits: ${rows.length} (${lineage.length} lineage) -> ${OUT}`)
}
