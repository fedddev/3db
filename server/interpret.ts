// The AI half of 3db's voice: turns a phrase the in-browser parser couldn't
// handle into Commands, using Claude Haiku 4.5 with structured output so the
// reply always matches the command contract in src/commands/types.ts.
//
// Runs server-side only (it holds the API key). `handleInterpret` is a plain
// web-standard handler, so it fits Vite dev middleware today and Firebase
// Functions / Cloudflare Workers / Vercel later.

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Command } from '../src/commands/types.ts'

const MODEL = 'claude-haiku-4-5'
const MAX_TEXT = 300
const MAX_COMMANDS = 5

// Mirrors src/commands/types.ts. The assignment below fails to compile if the two drift.
const Field = z.string().describe('A column name, exactly as listed in the context')
const FilterSchema = z.object({
  field: Field,
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']),
  value: z.union([z.string(), z.number()]),
})
const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dataset'), id: z.string().describe('A dataset id from the context') }),
  z.object({ type: z.literal('groupBy'), field: Field.nullable() }),
  z.object({ type: z.literal('sortBy'), field: Field.nullable(), dir: z.enum(['asc', 'desc']) }),
  z.object({ type: z.literal('filter'), filter: FilterSchema }),
  z.object({ type: z.literal('clearFilters') }),
  z.object({ type: z.literal('encode'), channel: z.enum(['height', 'color']), field: Field.nullable() }),
  z.object({ type: z.literal('layout'), mode: z.enum(['grid', 'timeline', 'geo']) }),
  z.object({
    type: z.literal('flyTo'),
    target: z.union([z.enum(['overview', 'home', 'selected']), z.object({ group: z.string() })]),
  }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('help') }),
])
const ResponseSchema = z.object({
  commands: z.array(CommandSchema).describe('Commands to run in order. Empty if nothing fits.'),
  reply: z.string().describe('One or two short sentences for the narrator to say.'),
})
export type InterpretResponse = { commands: Command[]; reply: string }
const _contract: Command[] = [] as z.infer<typeof ResponseSchema>['commands']
void _contract

const ContextSchema = z.object({
  dataset: z.object({ id: z.string(), name: z.string() }),
  columns: z.array(z.object({ name: z.string(), kind: z.string() })).max(200),
  datasets: z.array(z.object({ id: z.string(), name: z.string() })).max(50),
  groups: z.array(z.string()).max(60),
  spec: z.unknown(),
  samples: z.record(z.string(), z.array(z.unknown()).max(5)).optional(),
})
const RequestSchema = z.object({ text: z.string().min(1).max(MAX_TEXT), context: ContextSchema })
export type InterpretRequest = z.infer<typeof RequestSchema>

const SYSTEM = `You translate what a visitor says into commands for 3db, a 3D database the visitor walks through. Every row is a box in a 3D world. The visitor spoke or typed a phrase that a simple keyword parser couldn't handle; speech recognition may have mangled words, so read generously.

What each command does:
- dataset: switch to another world (use an id from "datasets").
- groupBy: gather rows into labeled districts by a column (null = ungroup).
- sortBy: order rows by a column; desc puts the biggest first (null field = unsort).
- filter: rows that don't match sink into the floor. Filtering the same field again replaces the old filter. Numeric ops need a number value; text ops compare case-insensitively.
- clearFilters: raise everything back up.
- encode: map a column to box height (numbers only) or color (any column). null clears it.
- layout: grid (districts), timeline (time runs away from the viewer), geo (map, with depth below the floor; only when the data has lat/lon).
- flyTo: move the camera to "overview", "home", "selected" (the clicked record), or {group} (a current group name from "groups").
- reset: back to the world's default view. help: list what the visitor can say.

Rules:
- Use only column names from "columns", dataset ids from "datasets", and group names from "groups".
- Combine commands when the phrase asks for several things ("show quakes in Alaska by depth" = filter + encode).
- For questions about the data ("what's the biggest?", "where are the deepest?"), answer by arranging the world so the answer is visible: sort, filter, color, group, or fly. You cannot see the rows, so never state specific values; say where to look instead.
- If nothing fits, return no commands and say briefly what you can do.
- The reply is spoken aloud by the narrator: plain, warm, at most two short sentences, no markdown.`

// The API's structured-output grammar supports const/enum/anyOf but not
// oneOf or type arrays, so adapt Zod's JSON Schema to that subset. (The SDK's
// own zod helper keeps it valid by demoting enum/const to descriptions, which
// would let the model invent command types; this keeps them enforced.)
function toApiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toApiSchema)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue
    if (key === 'oneOf') out.anyOf = toApiSchema(value)
    else if (key === 'type' && Array.isArray(value)) out.anyOf = value.map((type) => ({ type }))
    else out[key] = toApiSchema(value)
  }
  return out
}
export const OUTPUT_SCHEMA = toApiSchema(z.toJSONSchema(ResponseSchema)) as Record<string, unknown>

let client: Anthropic | null = null

export async function interpret(req: InterpretRequest, apiKey: string): Promise<InterpretResponse> {
  client ??= new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `<context>\n${JSON.stringify(req.context)}\n</context>\n\n<phrase>${req.text}</phrase>`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
  })
  if (response.stop_reason === 'refusal') return { commands: [], reply: "I can't help with that one." }
  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  let parsed: ReturnType<typeof ResponseSchema.safeParse>
  try {
    parsed = ResponseSchema.safeParse(JSON.parse(text))
  } catch {
    parsed = ResponseSchema.safeParse(null)
  }
  if (!parsed.success) return { commands: [], reply: "I didn't quite get that. Try rephrasing?" }
  return { commands: parsed.data.commands.slice(0, MAX_COMMANDS), reply: parsed.data.reply }
}

// Small in-memory guardrails. They reset when the process restarts, so the
// real ceiling is the spend limit on the Anthropic Console workspace.
const PER_IP_PER_MINUTE = 12
const PER_DAY = Number(process.env.THREEDB_AI_DAILY_LIMIT ?? 2000)
const recent = new Map<string, number[]>()
let day = new Date().toDateString()
let today = 0

function allow(ip: string): string | null {
  const now = Date.now()
  if (new Date().toDateString() !== day) {
    day = new Date().toDateString()
    today = 0
  }
  if (today >= PER_DAY) return "I've talked a lot today. The AI rests until tomorrow; simple commands still work."
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= PER_IP_PER_MINUTE) return 'Give me a moment, that was a lot of questions at once.'
  hits.push(now)
  recent.set(ip, hits)
  today++
  return null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function handleInterpret(request: Request, ip: string, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!apiKey) return json({ error: 'AI is not configured (no ANTHROPIC_API_KEY on the server).' }, 503)
  let body: InterpretRequest
  try {
    body = RequestSchema.parse(await request.json())
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const denied = allow(ip)
  if (denied) return json({ commands: [], reply: denied }, 429)
  try {
    return json(await interpret(body, apiKey))
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ commands: [], reply: 'The AI is busy right now. Try again in a moment.' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The server API key was rejected.' }, 503)
    if (err instanceof Anthropic.APIError) return json({ error: `AI error ${err.status}` }, 502)
    console.error(err)
    return json({ error: 'AI unavailable' }, 502)
  }
}
