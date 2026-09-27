import { useEffect, useRef, useState, type RefObject } from 'react'
import { COMMANDS } from '../commands/parse'
import { addCsv, runCommand, submit } from '../commands/run'
import { setState, useStore } from '../store'
import { speechSupported } from '../voice/useSpeech'
import { formatValue } from './format'

export function Hud({ inputRef, onToggleVoice }: { inputRef: RefObject<HTMLInputElement | null>; onToggleVoice: () => void }) {
  const locked = useStore((s) => s.locked)
  const loaded = useStore((s) => s.activeId !== null)
  return (
    <div className="hud">
      <Inspector />
      <Peek />
      {locked && <div className="crosshair" />}
      <div className="bottom">
        {loaded && <Toast />}
        {loaded ? <Keys /> : <Welcome />}
        <CommandBar inputRef={inputRef} onToggleVoice={onToggleVoice} />
      </div>
    </div>
  )
}

// Before any world: the narrator's welcome (and any file errors), plus upload.
function Welcome() {
  const message = useStore((s) => s.message)
  const heard = useStore((s) => s.heard)
  const interim = useStore((s) => s.interim)
  return (
    <div className="narrator panel">
      {(interim || heard) && <div className="heard">{interim ? `…${interim}` : `“${heard}”`}</div>}
      <div className="welcome">
        <div>{message}</div>
        <UploadButton label="Upload CSV" />
      </div>
    </div>
  )
}

// After a world loads, replies surface briefly above the keys, then fade.
const TOAST_MS = 4000
function Toast() {
  const message = useStore((s) => s.message)
  const messageId = useStore((s) => s.messageId)
  const heard = useStore((s) => s.heard)
  const interim = useStore((s) => s.interim)
  // The newest message shows until its timer marks it expired.
  const [expiredId, setExpiredId] = useState(-1)
  useEffect(() => {
    const t = setTimeout(() => setExpiredId(messageId), TOAST_MS)
    return () => clearTimeout(t)
  }, [messageId])
  const visible = !!interim || expiredId !== messageId
  return (
    <div className={`toast panel ${visible ? 'on' : ''}`} role="status" aria-live="polite">
      {(interim || heard) && <div className="heard">{interim ? `…${interim}` : `“${heard}”`}</div>}
      {!interim && <div>{message}</div>}
    </div>
  )
}

function UploadButton({ label }: { label: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className="upload" onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = '' // choosing the same file again still fires
          if (file) addCsv(file)
        }}
      />
    </>
  )
}

// The loaded world's keys: facts about the file, its columns, and what to say.
function Keys() {
  const ds = useStore((s) => (s.activeId ? s.datasets[s.activeId] : null))
  const shown = useStore((s) => s.rows.length)
  const open = useStore((s) => s.keysOpen)
  if (!ds) return null
  const file = ds.def.file
  const records = file?.rows ?? shown
  return (
    <div className="keys panel">
      <div className="keys-head">
        <strong>{ds.def.name}</strong>
        <UploadButton label="Upload another" />
      </div>
      <div className="facts">
        <span>{records.toLocaleString()} records{records > shown ? ` (showing ${shown.toLocaleString()})` : ''}</span>
        <span>{ds.columns.length} columns</span>
        {file && <span>edited {new Date(file.lastModified).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>}
        <button type="button" className="toggle" aria-expanded={open} onClick={() => setState({ keysOpen: !open })}>
          {open ? 'Hide keys' : 'Show keys'}
        </button>
      </div>
      {open && (
        <>
          <div className="keys-section">
            <div className="eyebrow">Columns</div>
            <ul className="columns">
              {ds.columns.map((c) => (
                <li key={c.name}>
                  {c.name} <span>{c.kind}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="keys-section">
            <div className="eyebrow">Say or type</div>
            <dl className="commands">
              {COMMANDS.map((c) => (
                <div key={c.say}>
                  <dt>{c.say}</dt>
                  <dd>{c.does}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </div>
  )
}

function CommandBar({ inputRef, onToggleVoice }: { inputRef: RefObject<HTMLInputElement | null>; onToggleVoice: () => void }) {
  const [text, setText] = useState('')
  const listening = useStore((s) => s.listening)
  return (
    <form
      className="command panel"
      onSubmit={(e) => {
        e.preventDefault()
        submit(text)
        setText('')
      }}
    >
      <button
        type="button"
        className={`mic ${listening ? 'on' : ''}`}
        onClick={onToggleVoice}
        title={speechSupported ? 'Talk to 3db (V)' : 'Voice needs Chrome, Edge or Safari'}
        aria-pressed={listening}
      >
        <MicIcon />
        {listening ? 'listening' : 'talk'}
      </button>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        placeholder='Type a command: "group by <column>", "color by <column>", "help"'
        aria-label="Command"
      />
    </form>
  )
}

function Inspector() {
  const selected = useStore((s) => s.selected)
  const rows = useStore((s) => s.rows)
  const ds = useStore((s) => (s.activeId ? s.datasets[s.activeId] : null))
  if (selected === null || !rows[selected] || !ds) return null
  const row = rows[selected]
  const title = ds.labelField ? formatValue(row[ds.labelField]) : `Record ${selected + 1}`
  return (
    <div className="inspector panel">
      <div className="inspector-head">
        <strong>{title}</strong>
        <button onClick={() => useStore.setState({ selected: null })} aria-label="Close">
          ×
        </button>
      </div>
      <dl>
        {ds.columns.map((c) => (
          <div key={c.name}>
            <dt>{c.name}</dt>
            <dd>{formatValue(row[c.name], c)}</dd>
          </div>
        ))}
      </dl>
      <button className="link" onClick={() => runCommand({ type: 'flyTo', target: 'selected' })}>
        Fly to it
      </button>
    </div>
  )
}

// What's under the crosshair (or the mouse), without clicking.
function Peek() {
  const hovered = useStore((s) => s.hovered)
  const rows = useStore((s) => s.rows)
  const ds = useStore((s) => (s.activeId ? s.datasets[s.activeId] : null))
  const spec = useStore((s) => s.spec)
  if (hovered === null || !rows[hovered] || !ds) return null
  const row = rows[hovered]
  const col = (name: string | null) => ds.columns.find((c) => c.name === name)
  const extras = [spec.height, spec.color].filter((f, i, a): f is string => !!f && a.indexOf(f) === i && f !== ds.labelField)
  return (
    <div className="peek">
      {ds.labelField && <strong>{formatValue(row[ds.labelField])}</strong>}
      {extras.map((f) => (
        <span key={f}>
          {f}: {formatValue(row[f], col(f))}
        </span>
      ))}
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
