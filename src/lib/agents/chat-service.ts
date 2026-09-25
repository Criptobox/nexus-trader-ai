// ─────────────────────────────────────────────────────────────
// Servicio de conversación del agente — el chat con contexto
// · Memoria del agente (episódica/semántica/preferencias)
// · Datos de mercado en vivo como herramientas
// · Base de conocimientos para preguntas educativas
// · Historial de conversación persistente
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import { routeLLM } from '@/lib/router/model-router'
import { buildMemoryContext, remember } from '@/lib/memory/agent-memory'
import { kbContextForQuery, KB_ARTICLES } from '@/lib/knowledge/kb'
import { getQuote, getQuotes } from '@/lib/market/data'
import { analyzeTechnicals } from '@/lib/indicators'
import { getCandles } from '@/lib/market/data'
import { searchCoins, getCustomQuotes } from '@/lib/market/custom'
import { getPortfolio } from '@/lib/trading/paper-engine'
import { AGENT_PROFILES } from '@/lib/agents/base-agent'
import type { AgentId, Quote } from '@/lib/types'

const COIN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC', 'LTC', 'ATOM', 'UNI', 'TON', 'TRX', 'SHIB', 'ARB', 'OP', 'APT']

// palabras técnicas/españolas que NO son tickers al detectar símbolos
const NON_TICKER = new Set(['RSI', 'MACD', 'ATR', 'SL', 'TP', 'IA', 'PNL', 'API', 'USD', 'USDT', 'EMA', 'SMA', 'ETF', 'AI', 'BTC', 'P2P', 'KYC', 'DCA', 'NFT', 'DAO', 'L1', 'L2', 'CEX', 'DEX', 'APY'])

export interface ChatInput {
  conversationId?: string
  message: string
  agentId?: AgentId
  cgId?: string // id CoinGecko para monedas fuera del universo base (radar/custom)
}

export interface ChatOutput {
  conversationId: string
  reply: string
  agentId: AgentId
  meta: Record<string, unknown>
}

// Detecta herramientas que la petición necesita
// (símbolo con límites de palabra: "stop" no debe activar "OP")
function detectTools(message: string): { prices: boolean; technical: boolean; portfolio: boolean; kb: boolean; symbol?: string } {
  const lower = message.toLowerCase()
  const symbol = COIN_SYMBOLS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(message))
  return {
    prices: /(precio|price|cuánto|cotiza|mercado|market|subiendo|bajando)/.test(lower),
    technical: /(rsi|macd|tendencia|análisis|analiza|soporte|resistencia|indicador|gráf|candle|vela)/.test(lower),
    portfolio: /(portafolio|portfolio|posición|posición|pnl|equity|paper|cuenta)/.test(lower),
    kb: /(qué es|que es|cómo funciona|como funciona|explica|concepto|significa|aprende|diferencia)/.test(lower),
    symbol,
  }
}

// resuelve cualquier otra moneda mencionada (ONDO, HYPE, PEPE…):
// base → búsqueda CoinGecko (caché 30 min) → cotización con logo
async function resolveExtraQuote(message: string): Promise<{ quote: Quote; cgId?: string } | null> {
  const candidates = (message.match(/\b[A-Z]{2,10}\b/g) ?? []).filter(
    (w) => !NON_TICKER.has(w) && !COIN_SYMBOLS.includes(w),
  ).slice(0, 3)
  for (const cand of candidates) {
    const { quotes } = await getQuotes()
    const base = quotes.find((q) => q.symbol === cand)
    if (base) return { quote: base }
    const results = await searchCoins(cand).catch(() => [])
    const hit = results.find((r) => r.symbol === cand) ?? results[0]
    if (hit) {
      const cq = await getCustomQuotes([{ id: hit.id }]).catch(() => [])
      if (cq[0]) return { quote: { ...cq[0], symbol: cq[0].symbol || cand }, cgId: hit.id }
    }
  }
  return null
}

// bloque de contexto técnico idéntico para base y monedas externas
async function marketBlock(symbol: string, quote: Quote, cgId?: string): Promise<string> {
  const { candles, source } = await getCandles(symbol, '1h', 120, cgId)
  const snap = analyzeTechnicals(candles)
  return `DATOS ${symbol} (${source === 'demo' ? 'demo' : source === 'binance' ? 'Binance' : 'CoinGecko'}): nombre ${quote.name ?? symbol}, precio $${quote.price.toPrecision(6)}, 24h ${quote.change24h.toFixed(2)}%, volumen ${Math.round(quote.volume24h).toLocaleString('en-US')}.
Técnico 1h: tendencia ${snap.trend}, momentum ${snap.momentumScore}, RSI ${snap.rsi14?.toFixed(1)}, MACD hist ${snap.macdHist?.toFixed(4)}, ATR ${snap.atrPct?.toFixed(2)}%, soporte ${snap.support.toPrecision(6)}, resistencia ${snap.resistance.toPrecision(6)}.`
}

async function gatherContext(message: string, cgId?: string): Promise<{ marketCtx: string; memoryCtx: string; kbCtx: string; portfolioCtx: string }> {
  const tools = detectTools(message)
  const parts: string[] = []

  if (cgId && !tools.symbol) {
    // moneda explícita vía CoinGecko (radar / moneda custom)
    const cq = await getCustomQuotes([{ id: cgId }]).catch(() => [])
    if (cq[0]) parts.push(await marketBlock(cq[0].symbol, cq[0], cgId))
  } else if (tools.symbol) {
    const quote = await getQuote(tools.symbol)
    if (quote) parts.push(await marketBlock(tools.symbol, quote))
  } else if (tools.prices || tools.technical) {
    // ¿menciona una moneda fuera del universo base? (ONDO, HYPE…)
    const extra = await resolveExtraQuote(message).catch(() => null)
    if (extra) {
      parts.push(await marketBlock(extra.quote.symbol, extra.quote, extra.cgId))
    } else if (tools.prices) {
      const { quotes, source } = await getQuotes()
      parts.push(`COTIZACIONES (${source === 'demo' ? 'modo demo sintético' : 'Binance en vivo'}):\n` +
        quotes.slice(0, 10).map((q) => `${q.symbol}: $${q.price.toPrecision(6)} (${q.change24h >= 0 ? '+' : ''}${q.change24h.toFixed(2)}% 24h)`).join('\n'))
    }
  }

  if (tools.portfolio) {
    try {
      const p = await getPortfolio()
      parts.push(`PORTAFOLIO PAPER: equity ${p.equity} ${p.account.baseCurrency}, PnL total ${p.totalPnl} (${p.totalPnlPct.toFixed(2)}%), efectivo ${p.account.cash}, posiciones abiertas ${p.positions.length}.`)
    } catch { /* ignora */ }
  }

  if (tools.kb) {
    const kb = kbContextForQuery(message)
    if (kb) parts.push(`BASE DE CONOCIMIENTOS:\n${kb}`)
  }

  const memoryCtx = await buildMemoryContext(message)
  return {
    marketCtx: parts.join('\n\n'),
    memoryCtx,
    kbCtx: '',
    portfolioCtx: '',
  }
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const agentId = (input.agentId && input.agentId in AGENT_PROFILES ? input.agentId : 'orchestrator') as AgentId
  const profile = AGENT_PROFILES[agentId]

  // conversación
  let conversationId = input.conversationId
  if (!conversationId) {
    const conv = await db.conversation.create({
      data: { title: input.message.slice(0, 60), agentId },
    })
    conversationId = conv.id
  }

  const history = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })
  history.reverse()

  await db.message.create({
    data: { conversationId, role: 'user', content: input.message },
  })

  // contextos
  const ctx = await gatherContext(input.message, input.cgId)
  const lower = input.message.toLowerCase()
  const wantsTrading = /(compra|vende|buy|sell|entra|abre posición|analiza.*(btc|eth|sol)|señal|operaci)/.test(lower)

  const systemPrompt = `${profile.systemPrompt}

ERES PARTE DE NEXUS TRADER AI — asistente de trading cripto con arquitectura multiagente. Reglas inquebrantables:
1. NUNCA das consejos financieros personalizados de compra/venta con dinero real. Si el usuario pide ejecutar operaciones reales, explica que NEXUS opera en modo paper (simulado) por diseño y seguridad.
2. Usas SIEMPRE los datos de mercado proporcionados cuando existan — nunca inventas precios.
3. Respondes en el idioma del usuario (español por defecto), con formato claro, conciso y accionable. Usas markdown ligero (negritas, listas cortas).
4. Tu personalidad: ${profile.name}, ${profile.role.toLowerCase()} — ${profile.specialty}.
5. Recuerdas el contexto de memoria proporcionado y lo usas para personalizar.`

  const userContent = `${wantsTrading ? '[El usuario quiere análisis/operativa — recuerda el modo paper]' : ''}

CONTEXTO DEL SISTEMA:
${ctx.marketCtx || '(sin datos de mercado solicitados)'}

MEMORIA DEL AGENTE:
${ctx.memoryCtx}

HISTORIAL RECIENTE:
${history.map((m) => `${m.role === 'user' ? 'Usuario' : 'NEXUS'}: ${m.content.slice(0, 300)}`).join('\n') || '(vacío)'}

MENSAJE DEL USUARIO:
${input.message}`

  // LLM vía router
  let reply = ''
  try {
    const result = await routeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      task: agentId === 'educator' ? 'chat' : 'analysis',
      temperature: 0.5,
      maxTokens: 1200,
    })
    reply = result.content.trim()
  } catch (err) {
    reply = fallbackReply(input.message, ctx, err instanceof Error ? err.message : 'error desconocido')
  }

  await db.message.create({
    data: {
      conversationId, role: 'assistant', agentId,
      content: reply,
      meta: JSON.stringify({ agent: profile.id, hadMarketData: !!ctx.marketCtx }),
    },
  })

  // aprende preferencias si el usuario las declara
  const prefMatch = /(prefiero|mi riesgo es|no me gusta|me gusta|odio|quiero evitar)/i.exec(input.message)
  if (prefMatch) {
    await remember({
      kind: 'preference',
      key: 'user-preferencias',
      content: input.message.slice(0, 200),
      importance: 0.7,
      tags: ['preferencia'],
    })
  }

  return { conversationId, reply, agentId, meta: { hadMarketData: !!ctx.marketCtx, agent: profile.id } }
}

function fallbackReply(message: string, ctx: { marketCtx: string; memoryCtx: string }, error: string): string {
  const data = ctx.marketCtx || 'No hay datos de mercado para tu consulta.'
  return `⚠️ **Modo degradado** — el router de modelos no está disponible (${error.slice(0, 120)}).

Aún así, aquí tienes los datos del sistema:

${data}

Puedes usar las pantallas de **Mercados** para gráficos e indicadores, **Análisis** para el pipeline multiagente determinista y **Backtest** para validar estrategias — funcionan 100% sin LLM.`
}

export async function listConversations(): Promise<{ id: string; title: string; updatedAt: string; messageCount: number }[]> {
  const convs = await db.conversation.findMany({ orderBy: { updatedAt: 'desc' }, take: 30 })
  const counts = await db.message.groupBy({ by: ['conversationId'], _count: true })
  return convs.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    messageCount: counts.find((x) => x.conversationId === c.id)?._count ?? 0,
  }))
}

export async function getConversation(id: string) {
  const conv = await db.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
  })
  if (!conv) return null
  return {
    id: conv.id, title: conv.title, agentId: conv.agentId,
    messages: conv.messages.map((m) => ({
      id: m.id, role: m.role, agentId: m.agentId,
      content: m.content, createdAt: m.createdAt.toISOString(),
    })),
  }
}

export const KB_SUGGESTIONS = KB_ARTICLES.map((a) => a.title)
