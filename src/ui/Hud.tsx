import { useState, type RefObject } from 'react'
import { runCommand, submit } from '../commands/run'
import type { Command } from '../commands/types'
import { RAMP_CSS } from '../scene/colors'
import type { Legend } from '../scene/layout'
import { useStore } from '../store'
import { speechSupported } from '../voice/useSpeech'
import { formatValue } from './format'

export function Hud({ inputRef, onToggleVoice }: { inputRef: RefObject<HTMLInputElement | null>; onToggleVoice: () => void }) {
  const locked = useStore((s) => s.locked)
  return (
    <div className="hud">
      <TopBar />
      <Inspector />
      <Peek />
      {locked && <div className="crosshair" />}
      <div className="bottom">
        <Narrator />
        <CommandBar inputRef={inputRef} onToggleVoice={onToggleVoice} />
      </div>
      <LegendPanel />
      <Keys />
    </div>
  )
}

function TopBar() {
  const defs = useStore((s) => s.defs)
  const activeId = useStore((s) => s.activeId)
  const loading = useStore((s) => s.loading)
  const spec = useStore((s) => s.spec)
  const layout = useStore((s) => s.layout)
  const rows = useStore((s) => s.rows)

  const chips: { label: string; clear?: Command }[] = [{ label: `layout: ${layout?.mode ?? spec.layout}` }]
  if (spec.groupBy) chips.push({ label: `group: ${spec.groupBy}`, clear: { type: 'groupBy', field: null } })
  if (spec.sortBy) chips.push({ label: `sort: ${spec.sortBy.field} ${spec.sortBy.dir === 'desc' ? '↓' : '↑'}`, clear: { type: 'sortBy', field: null, dir: 'asc' } })
  if (spec.height) chips.push({ label: `height: ${spec.height}`, clear: { type: 'encode', channel: 'height', field: null } })
  if (spec.color) chips.push({ label: `color: ${spec.color}`, clear: { type: 'encode', channel: 'color', field: null } })
  if (spec.filters.length) chips.push({ label: `filter: ${spec.filters.map((f) => `${f.field} ${f.op} ${f.value}`).join(', ')}`, clear: { type: 'clearFilters' } })

  return (
    <div className="top panel">
      <div className="brand">
        3db<span>a database you can walk through</span>
      </div>
      <div className="tabs">
        {defs.map((d) => (
          <button key={d.id} className={d.id === activeId ? 'active' : ''} onClick={() => runCommand({ type: 'dataset', id: d.id })}>
            {loading === d.name ? '…' : d.name}
          </button>
        ))}
      </div>
      <div className="chips">
        <span className="count">
          {layout && layout.matches !== rows.length ? `${layout.matches} of ${rows.length}` : rows.length} records
        </span>
        {chips.map((c) => (
          <span key={c.label} className="chip">
            {c.label}
            {c.clear && (
              <button aria-label={`Clear ${c.label}`} onClick={() => runCommand(c.clear!)}>
                ×
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function Narrator() {
  const message = useStore((s) => s.message)
  const heard = useStore((s) => s.heard)
  const interim = useStore((s) => s.interim)
  return (
    <div className="narrator panel">
      {(interim || heard) && <div className="heard">{interim ? `…${interim}` : `“${heard}”`}</div>}
      <div>{message}</div>
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
        submit(text, 'typed')
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
        placeholder='Type a command: "group by region", "color by depth", "help"'
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

function LegendPanel() {
  const legend = useStore((s) => s.layout?.legend)
  if (!legend) return null
  return (
    <div className="legend panel">
      <div className="legend-title">color: {legend.field}</div>
      <LegendBody legend={legend} />
    </div>
  )
}

function LegendBody({ legend }: { legend: Legend }) {
  if (legend.kind === 'sequential') {
    return (
      <>
        <div className="ramp" style={{ background: RAMP_CSS }} />
        <div className="ramp-labels">
          <span>{formatValue(legend.min, legend.column)}</span>
          <span>{formatValue(legend.max, legend.column)}</span>
        </div>
      </>
    )
  }
  return (
    <ul>
      {legend.entries.map((e) => (
        <li key={e.label}>
          <i style={{ background: e.color }} />
          {e.label}
        </li>
      ))}
    </ul>
  )
}

function Keys() {
  const locked = useStore((s) => s.locked)
  return (
    <div className="keys panel">
      {locked ? (
        <>
          <b>click</b> inspect · <b>Esc</b> release mouse
        </>
      ) : (
        <>
          <b>click the world</b> to look around
        </>
      )}
      <br />
      <b>WASD</b> move · <b>Space/C</b> up/down · <b>Shift</b> run
      <br />
      <b>V</b> voice · <b>/</b> type · drop a <b>.csv</b> to explore it
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
