import type { Command } from './types'

// Where the AI proxy lives. Same-origin in dev (Vite middleware); set
// VITE_AI_URL when the proxy is deployed somewhere else.
const AI_URL = import.meta.env.VITE_AI_URL ?? '/api/interpret'

export interface AiContext {
  dataset: { id: string; name: string }
  columns: { name: string; kind: string }[]
  datasets: { id: string; name: string }[]
  groups: string[]
  spec: unknown
  // A few common values per text column, so "California" can become "CA".
  samples: Record<string, string[]>
}

export type AiResult = { commands: Command[]; reply: string } | { error: string }

export async function askAi(text: string, context: AiContext): Promise<AiResult> {
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 300), context }),
    })
    const body = (await res.json()) as Partial<{ commands: Command[]; reply: string; error: string }>
    if (body.error) return { error: body.error }
    return { commands: body.commands ?? [], reply: body.reply ?? '' }
  } catch {
    return { error: 'AI unreachable' }
  }
}
