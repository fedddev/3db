import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { addCsv, boot, submit } from './commands/run'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { isTyping } from './ui/keys'
import { useSpeech } from './voice/useSpeech'

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { toggle } = useSpeech((text) => submit(text))

  useEffect(() => {
    boot()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'KeyV') toggle()
      if (e.code === 'Slash' || e.code === 'Enter') {
        e.preventDefault()
        document.exitPointerLock()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragging(false)
        const file = [...e.dataTransfer.files].find((f) => /\.(csv|tsv|txt)$/i.test(f.name))
        if (file) await addCsv(file.name, await file.text())
      }}
    >
      <div id="world">
        {/* Eye height (1.6 m), 10 m back from the origin, looking at it. */}
        <Canvas
          camera={{ fov: 70, near: 0.1, far: 3000, position: [0, 1.6, -10] }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
          dpr={[1, 2]}
        >
          <World />
        </Canvas>
      </div>
      <Hud inputRef={inputRef} onToggleVoice={toggle} />
      {dragging && <div className="drop">Drop a CSV to turn it into a world</div>}
    </div>
  )
}
