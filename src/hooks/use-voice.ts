'use client'

// ─────────────────────────────────────────────────────────────
// Hook de conversación por voz — Web Speech API (es-ES/es-MX)
// · Reconocimiento de voz (STT) con micrófono
// · Síntesis de voz (TTS) para las respuestas del agente
//   con selección de la mejor voz en español disponible
// · Estado `speaking` para sincronizar el avatar del agente
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
  resultIndex: number
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

// elige la mejor voz en español del sistema (natural > Google > MS > cualquiera)
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith('es'))
  return (
    es.find((v) => /google/i.test(v.name) && /es[-_]mx|es[-_]us/i.test(v.lang)) ??
    es.find((v) => /google/i.test(v.name)) ??
    es.find((v) => /microsoft/i.test(v.name) && /natural|online/i.test(v.name)) ??
    es.find((v) => /microsoft/i.test(v.name)) ??
    es[0] ??
    null
  )
}

export function useVoice(onFinalTranscript?: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [supported, setSupported] = useState(false)
  const [speakEnabled, setSpeakEnabled] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalCallback = useRef(onFinalTranscript)

  useEffect(() => {
    finalCallback.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const t = setTimeout(() => setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition)), 0)
    // calienta la lista de voces (carga asíncrona en Chrome)
    if (window.speechSynthesis) {
      pickSpanishVoice()
      window.speechSynthesis.onvoiceschanged = () => pickSpanishVoice()
    }
    return () => clearTimeout(t)
  }, [])

  const startListening = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return

    recognitionRef.current?.abort()
    const rec = new Ctor()
    rec.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-ES'
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (e) => {
      let interimText = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) finalText += text
        else interimText += text
      }
      setInterim(interimText)
      if (finalText) {
        setTranscript(finalText.trim())
        setInterim('')
        finalCallback.current?.(finalText.trim())
      }
    }
    rec.onend = () => { setListening(false); setInterim('') }
    rec.onerror = () => { setListening(false); setInterim('') }

    recognitionRef.current = rec
    setTranscript('')
    rec.start()
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    // limpiar markdown para la voz
    const clean = text
      .replace(/[#*`_~>|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .slice(0, 600)
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-ES'
    const voice = pickSpanishVoice()
    if (voice) utter.voice = voice
    utter.rate = 1.05
    utter.pitch = 1
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
  }, [])

  return {
    listening, transcript, interim, supported,
    startListening, stopListening,
    speakEnabled, setSpeakEnabled,
    speaking, speak, stopSpeaking,
  }
}
