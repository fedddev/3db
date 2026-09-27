import { useCallback, useEffect, useRef } from 'react'
import { getState, say, setState } from '../store'

// Minimal typing for the Web Speech API, which TypeScript's DOM lib doesn't
// fully cover (and which Chrome still ships prefixed).
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

export const speechSupported = !!Ctor

// Keeps listening until toggled off (recognition stops itself after silence,
// so it restarts on end, as the 2018 app did). Final phrases go to onPhrase.
export function useSpeech(onPhrase: (text: string) => void) {
  const rec = useRef<Recognition | null>(null)
  const wanted = useRef(false)
  const handler = useRef(onPhrase)
  useEffect(() => {
    handler.current = onPhrase
  }, [onPhrase])

  const stop = useCallback(() => {
    wanted.current = false
    rec.current?.stop()
    setState({ listening: false, interim: '' })
  }, [])

  const start = useCallback(() => {
    if (!Ctor) {
      say("This browser doesn't do speech recognition (try Chrome, Edge or Safari). You can still type commands.")
      return
    }
    if (!rec.current) {
      const r = new Ctor()
      r.continuous = true
      r.interimResults = true
      r.lang = 'en-US'
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (result.isFinal) handler.current(result[0].transcript)
          else interim += result[0].transcript
        }
        setState({ interim })
      }
      r.onend = () => {
        if (!wanted.current) return
        try {
          r.start()
        } catch {
          // Already restarting.
        }
      }
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          stop()
          say('Microphone access was blocked. Allow it in the address bar to talk to 3db.')
        }
      }
      rec.current = r
    }
    wanted.current = true
    try {
      rec.current.start()
    } catch {
      // Already started.
    }
    setState({ listening: true })
  }, [stop])

  const toggle = useCallback(() => (getState().listening ? stop() : start()), [start, stop])

  useEffect(() => () => {
    wanted.current = false
    rec.current?.stop()
  }, [])

  return { toggle }
}
