import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { addCsv, boot, submit } from './commands/run'
import { World } from './scene/World'
import { START_LOOK_AT, START_POSITION } from './store'
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
        const file = e.dataTransfer.files[0]
        if (file) await addCsv(file)
      }}
    >
      <div id="world">
        <Canvas
          camera={{ fov: 70, near: 0.1, far: 3000, position: START_POSITION }}
          onCreated={({ camera }) => camera.lookAt(...START_LOOK_AT)}
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
