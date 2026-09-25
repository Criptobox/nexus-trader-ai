'use client'

// ─────────────────────────────────────────────────────────────
// Agente — chat multiagente con voz + pipeline de análisis
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Send, BrainCircuit, Loader2, FlaskConical, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentAvatar, AGENT_PROFILES } from '@/components/agents/agent-avatar'
import { NexusAvatar, type NexusState } from '@/components/agents/nexus-avatar'
import { NexusAvatar3D, type Nexus3DState } from '@/components/agents/nexus-3d'
import { CoinIcon } from '@/components/coin-icon'
import { useVoice } from '@/hooks/use-voice'
import { useAppStore } from '@/lib/store'
import type { AgentId, TradeDecision, AgentOpinion } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  agentId?: string
  content: string
}

const QUICK_PROMPTS = [
  '¿En qué debería invertir hoy?',
  '¿Cómo está BTC ahora mismo?',
  'Analiza ETH con indicadores técnicos',
  '¿Qué proyecto emergente sigue el radar?',
]

const ANALYZABLE = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'LINK']

// mini renderizador markdown (negritas, listas, títulos)
function renderMarkdownLite(text: string) {
  return text.split('\n').map((line, i) => {
    const bold = (s: string) =>
      s.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
          : part
      )
    if (/^#{1,3}\s/.test(line)) return <p key={i} className="mt-2 mb-1 text-sm font-bold">{bold(line.replace(/^#+\s/, ''))}</p>
    if (/^[-·•]\s/.test(line)) return <li key={i} className="ml-4 list-disc text-[13px] leading-relaxed">{bold(line.replace(/^[-·•]\s/, ''))}</li>
    if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-[13px] leading-relaxed">{bold(line)}</li>
    if (!line.trim()) return <div key={i} className="h-1.5" />
    return <p key={i} className="text-[13px] leading-relaxed">{bold(line)}</p>
  })
}

function OpinionCard({ opinion }: { opinion: AgentOpinion }) {
  const profile = AGENT_PROFILES[opinion.agentId]
  return (
    <div className="glass flex gap-3 rounded-2xl p-3">
      <AgentAvatar agentId={opinion.agentId} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold">{profile.name}</p>
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
            opinion.verdict === 'bullish' ? 'bg-primary/15 text-primary' :
            opinion.verdict === 'bearish' ? 'bg-bear/15 text-bear' :
            'bg-surface-2 text-muted-foreground'
          )}>
            {opinion.verdict === 'bullish' ? 'Alcista' : opinion.verdict === 'bearish' ? 'Bajista' : 'Neutral'} {Math.round(opinion.confidence * 100)}%
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{opinion.summary}</p>
        {opinion.signals.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {opinion.signals.slice(0, 4).map((s, i) => (
              <li key={i} className="text-[10px] leading-snug text-muted-foreground">· {s}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DecisionCard({ decision }: { decision: TradeDecision }) {
  const actionLabel = decision.action === 'buy' ? 'COMPRAR' : decision.action === 'sell' ? 'VENDER' : 'MANTENER'
  const actionColor = decision.action === 'buy' ? 'text-primary' : decision.action === 'sell' ? 'text-bear' : 'text-muted-foreground'
  return (
    <div className="space-y-3">
      <div className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CoinIcon symbol={decision.symbol} size={40} />
            <div>
              <p className="text-sm font-bold">{decision.symbol}/USDT</p>
              <p className="text-[10px] text-muted-foreground">Comité multiagente</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-lg font-black tracking-tight', actionColor)}>{actionLabel}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">Confianza {Math.round(decision.confidence * 100)}%</p>
          </div>
        </div>

        {/* barras de confianza */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn('h-full rounded-full transition-all', decision.action === 'buy' ? 'bg-primary' : decision.action === 'sell' ? 'bg-bear' : 'bg-muted-foreground')}
            style={{ width: `${Math.round(decision.confidence * 100)}%` }}
          />
        </div>

        {/* plan */}
        <div className="mt-3 text-[12px] leading-relaxed">{renderMarkdownLite(decision.reasoning)}</div>

        {decision.entry && decision.stopLoss && decision.takeProfit && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface p-2">
              <p className="text-[9px] uppercase text-muted-foreground">Entrada</p>
              <p className="font-mono text-[11px] font-bold">{decision.entry.toPrecision(6)}</p>
            </div>
            <div className="rounded-xl bg-bear/10 p-2">
              <p className="text-[9px] uppercase text-muted-foreground">Stop</p>
              <p className="font-mono text-[11px] font-bold text-bear">{decision.stopLoss.toPrecision(6)}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2">
              <p className="text-[9px] uppercase text-muted-foreground">Objetivo</p>
              <p className="font-mono text-[11px] font-bold text-bull">{decision.takeProfit.toPrecision(6)}</p>
            </div>
          </div>
        )}

        <div className={cn('mt-3 rounded-xl px-3 py-2 text-[10px] font-semibold',
          decision.riskApproved ? 'bg-primary/10 text-primary' : 'bg-gold/10 text-gold')}>
          {decision.riskApproved ? '🛡️ Risk Engine: operación aprobada' : '🛡️ Risk Engine: sin ejecución — ' + (decision.riskNotes[0] ?? 'sin señal operable')}
        </div>
      </div>

      {decision.opinions.map((o) => <OpinionCard key={o.agentId} opinion={o} />)}
    </div>
  )
}

export function AgentView() {
  const [tab, setTab] = useState<'chat' | 'analysis'>('chat')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [activeAgent, setActiveAgent] = useState<AgentId>('orchestrator')
  const [analysisSymbol, setAnalysisSymbol] = useState('BTC')
  const [analysis, setAnalysis] = useState<TradeDecision | null>(null)
  const customCoins = useAppStore((s) => s.customCoins)
  const [analyzing, setAnalyzing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const marketSource = useAppStore((s) => s.marketSource)
  const sendRef = useRef<(text: string) => void>(() => {})
  const voice = useVoice((text) => sendRef.current(text))
  const speakEnabled = voice.speakEnabled
  const speak = voice.speak

  // estado vivo del avatar: escuchando → pensando → hablando → reposo
  const avatarState: NexusState = voice.listening
    ? 'listening'
    : sending
      ? 'thinking'
      : voice.speaking
        ? 'speaking'
        : 'idle'
  // el avatar 3D además celebra al analizar y se alerta con respuestas de riesgo
  const avatar3DState: Nexus3DState = avatarState !== 'idle'
    ? avatarState
    : tab === 'analysis' && analyzing
      ? 'thinking'
      : 'idle'

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const sendMessage = useCallback(async (text: string, cgId?: string) => {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: message }])
    setSending(true)
    scrollToBottom()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId, agentId: activeAgent, cgId }),
      }).then((r) => r.json())
      if (res.conversationId) setConversationId(res.conversationId)
      setMessages((m) => [...m, {
        id: `a-${Date.now()}`, role: 'assistant',
        agentId: res.agentId ?? activeAgent, content: res.reply ?? res.error ?? 'Sin respuesta',
      }])
      if (speakEnabled && res.reply) speak(res.reply)
    } catch {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: '⚠️ Error de conexión con el agente.' }])
    }
    setSending(false)
    scrollToBottom()
  }, [conversationId, sending, activeAgent, speakEnabled, speak])

  // el hook de voz usa la última versión de sendMessage vía ref
  useEffect(() => {
    sendRef.current = (text: string) => { void sendMessage(text) }
  }, [sendMessage])

  const runAnalysis = async (symbol: string, execute = false) => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const cgId = customCoins.find((c) => c.symbol === symbol)?.id
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, execute, cgId }),
      }).then((r) => r.json())
      setAnalysis(res)
    } catch {
      /* silencioso */
    }
    setAnalyzing(false)
  }

  // recupera análisis guardado desde Mercados (base o custom)
  // y preguntas preparadas desde otras vistas (radar → chat)
  useEffect(() => {
    const t = setTimeout(() => {
      const prefill = sessionStorage.getItem('nexus-chat-prefill')
      if (prefill) {
        sessionStorage.removeItem('nexus-chat-prefill')
        try {
          const { text, cgId } = JSON.parse(prefill) as { text: string; cgId?: string }
          void sendMessage(text, cgId)
        } catch {
          void sendMessage(prefill)
        }
        return
      }
      const saved = sessionStorage.getItem('nexus-analysis-current')
      if (saved) {
        sessionStorage.removeItem('nexus-analysis-current')
        try {
          const decision = JSON.parse(saved) as TradeDecision
          setAnalysisSymbol(decision.symbol)
          setAnalysis(decision)
          setTab('analysis')
        } catch { /* ignora */ }
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const agentChips: AgentId[] = ['orchestrator', 'technical', 'market-scout', 'risk-manager', 'strategist', 'educator']

  return (
    <div className="flex h-[calc(100dvh-160px)] flex-col">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'chat' | 'analysis')} className="flex h-full flex-col">
        <TabsList className="glass mx-auto mb-3 grid w-64 grid-cols-2 rounded-full p-1">
          <TabsTrigger value="chat" className="rounded-full text-xs">💬 Conversar</TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-full text-xs">🧠 Análisis</TabsTrigger>
        </TabsList>

        {/* ── TAB CHAT ── */}
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col space-y-3 data-[state=active]:flex">
          {/* selector de agente */}
          <div className="nexus-scroll flex gap-2 overflow-x-auto pb-1">
            {agentChips.map((id) => {
              const p = AGENT_PROFILES[id]
              return (
                <button
                  key={id}
                  onClick={() => setActiveAgent(id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                    activeAgent === id ? 'glass-strong ring-1 ring-primary/50' : 'glass opacity-70',
                  )}
                >
                  <AgentAvatar agentId={id} size={20} />
                  {p.name}
                </button>
              )
            })}
          </div>

          {/* mensajes */}
          <div ref={scrollRef} className="nexus-scroll min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl">
            {messages.length === 0 && (
              <div className="glass flex h-full flex-col items-center justify-center gap-2 rounded-3xl p-4 text-center">
                {/* escenario del avatar 3D — vivo, te sigue con la mirada y reacciona a los taps */}
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-x-8 top-6 bottom-2 rounded-full bg-primary/8 blur-2xl" />
                  <NexusAvatar3D state={avatar3DState} height={230} />
                </div>
                <p className="text-sm font-bold">{AGENT_PROFILES[activeAgent].name} · {AGENT_PROFILES[activeAgent].role}</p>
                <p className="max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
                  {AGENT_PROFILES[activeAgent].specialty}. Tócame, muéveme la mirada con el dedo y pregúntame dónde invertir — por texto o voz.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)} className="glass rounded-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors active:bg-surface-2">
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Modo: {marketSource === 'binance' ? 'datos Binance en vivo' : 'datos demo'} · ejecución solo paper
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && <AgentAvatar agentId={(m.agentId as AgentId) ?? 'orchestrator'} size={30} />}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                  m.role === 'user' ? 'bg-primary/15 text-foreground' : 'glass',
                )}>
                  {m.role === 'user'
                    ? <p className="text-[13px] leading-relaxed">{m.content}</p>
                    : <div className="space-y-0.5">{renderMarkdownLite(m.content)}</div>}
                </div>
                {m.role === 'user' && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                    <User size={15} />
                  </span>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <NexusAvatar size={34} state="thinking" />
                <Loader2 size={14} className="animate-spin" /> {AGENT_PROFILES[activeAgent].name} está pensando…
              </div>
            )}
          </div>

          {/* barra de estado del avatar */}
          <div className="glass flex items-center gap-2.5 rounded-2xl px-3 py-2">
            <NexusAvatar size={36} state={avatarState} />
            <div className="flex-1">
              <p className="text-[11px] font-bold">NEXUS</p>
              <p className="text-[10px] text-muted-foreground">
                {voice.listening ? '🎧 Escuchándote… habla ahora'
                  : sending ? '💭 Procesando con el comité…'
                  : voice.speaking ? '🔊 Respondiendo por voz'
                  : 'En reposo — escríbeme o pulsa el micrófono'}
              </p>
            </div>
          </div>

          {/* voz + input */}
          {voice.listening && (
            <div className="glass flex items-center justify-center gap-2 rounded-2xl py-2 text-xs text-primary">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              Escuchando… {voice.interim && <span className="italic text-muted-foreground">“{voice.interim}”</span>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={voice.listening ? voice.stopListening : voice.startListening}
              disabled={!voice.supported}
              aria-label={voice.listening ? 'Detener micrófono' : 'Hablar'}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95',
                voice.listening ? 'bg-bear text-white pulse-danger' : 'glass text-foreground',
                !voice.supported && 'opacity-40',
              )}
            >
              {voice.listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => { voice.setSpeakEnabled(!voice.speakEnabled); if (voice.speakEnabled) voice.stopSpeaking() }}
              aria-label={voice.speakEnabled ? 'Desactivar voz' : 'Activar voz'}
              className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95',
                voice.speakEnabled ? 'bg-primary/20 text-primary' : 'glass text-muted-foreground')}
            >
              {voice.speakEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={voice.listening ? 'Habla ahora…' : 'Pregunta a tu comité…'}
                className="glass border-0 text-sm"
                aria-label="Mensaje para el agente"
              />
              <Button
                type="submit" size="icon" disabled={sending || !input.trim()}
                className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-primary-foreground"
                aria-label="Enviar"
              >
                <Send size={17} />
              </Button>
            </form>
          </div>
          {!voice.supported && (
            <p className="text-center text-[10px] text-muted-foreground">
              🎙️ Tu navegador no soporta reconocimiento de voz — usa el teclado.
            </p>
          )}
        </TabsContent>

        {/* ── TAB ANÁLISIS ── */}
        <TabsContent value="analysis" className="nexus-scroll flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto data-[state=active]:flex">
          {/* chips = monedas base + tus monedas añadidas */}
          {customCoins.length > 0 && (
            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Incluye tus monedas añadidas</p>
          )}
          <div className="glass rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <BrainCircuit size={16} className="text-primary" /> Pipeline multiagente
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Vega analiza indicadores, Scout escanea momentum, Atlas sintetiza con LLM y Aegis valida el riesgo. Tú decides.
            </p>
            <div className="nexus-scroll mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {[...ANALYZABLE, ...customCoins.map((c) => c.symbol)].map((s) => (
                <button
                  key={s}
                  onClick={() => setAnalysisSymbol(s)}
                  className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all',
                    analysisSymbol === s ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'glass opacity-70')}
                >
                  <CoinIcon symbol={s} size={16} /> {s}
                </button>
              ))}
            </div>
            <Button
              onClick={() => runAnalysis(analysisSymbol)}
              disabled={analyzing}
              className="mt-3 w-full gap-2 rounded-xl bg-primary font-bold text-primary-foreground"
            >
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
              {analyzing ? 'Comité deliberando…' : `Analizar ${analysisSymbol} con el comité`}
            </Button>
          </div>

          {analyzing && (
            <div className="glass flex items-center gap-3 rounded-2xl p-4 text-xs text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-primary" />
              Vega y Scout calculando indicadores → Atlas sintetizando → Aegis validando riesgo…
            </div>
          )}

          {analysis && <DecisionCard decision={analysis} />}
          {!analysis && !analyzing && (
            <div className="glass rounded-2xl p-6 text-center">
              <AgentAvatar agentId="strategist" size={52} className="mx-auto" />
              <p className="mt-2 text-sm font-bold">Atlas espera tu orden</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Selecciona una moneda y lanza el análisis del comité.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
