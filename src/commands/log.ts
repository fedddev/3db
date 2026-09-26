// Everything said or typed to 3db, kept in this browser. It is also a dataset:
// the app can show you how people talk to it. Later this moves server-side.

export interface LogEntry {
  at: number
  text: string
  source: 'voice' | 'typed'
  understood: boolean
  handled_by: 'parser' | 'ai' | 'none'
  command: string
}

const KEY = '3db.commandLog'
const MAX = 1000

export function readLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LogEntry[]
  } catch {
    return []
  }
}

export function appendLog(entry: LogEntry) {
  try {
    const log = readLog()
    log.push(entry)
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)))
  } catch {
    // Storage unavailable (private mode, blocked): the log is best-effort.
  }
}
