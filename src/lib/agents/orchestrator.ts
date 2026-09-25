// ─────────────────────────────────────────────────────────────
// Pipeline de análisis multiagente
// · Vega (técnico) y Scout (mercado): opiniones deterministas
//   sobre indicadores — rápidas, reproducibles y sin alucinaciones
// · Aegis (riesgo): valida con el Risk Engine
// · Atlas (estratega): sintetiza con LLM vía router multi-modelo
// · Lyra (educadora): explica el concepto dominante del análisis
// ─────────────────────────────────────────────────────────────
import type { AgentOpinion, Candle, TechnicalSnapshot, TradeDecision } from '@/lib/types'
import { analyzeTechnicals } from '@/lib/indicators'
import { getCandles, getQuote } from '@/lib/market/data'
import { getCustomQuotes } from '@/lib/market/custom'
import { riskEngine } from '@/lib/risk/risk-engine'
import { buildMemoryContext, remember } from '@/lib/memory/agent-memory'
import { kbContextForQuery } from '@/lib/knowledge/kb'
import { routeLLM } from '@/lib/router/model-router'
import { AGENT_PROFILES } from '@/lib/agents/base-agent'
import { db } from '@/lib/db'

// ── Opinión determinista del analista técnico (Vega) ─────────
function technicalOpinion(snap: TechnicalSnapshot): AgentOpinion {
  const signals: string[] = []
  let score = 0

  if (snap.trend === 'up') { score += 25; signals.push(`Tendencia alcista (SMA20 > SMA50, precio sobre SMA20)`) }
  if (snap.trend === 'down') { score -= 25; signals.push(`Tendencia bajista (SMA20 < SMA50, precio bajo SMA20)`) }
  if (snap.sma200 !== null) {
    if (snap.price > snap.sma200) { score += 10; signals.push('Precio sobre SMA200 — régimen macro alcista') }
    else { score -= 10; signals.push('Precio bajo SMA200 — régimen macro bajista') }
  }
  if (snap.rsi14 !== null) {
    if (snap.rsi14 > 70) { score -= 8; signals.push(`RSI ${snap.rsi14.toFixed(1)} — sobrecompra, riesgo de corrección`) }
    else if (snap.rsi14 < 30) { score += 8; signals.push(`RSI ${snap.rsi14.toFixed(1)} — sobreventa, posible rebote`) }
    else signals.push(`RSI ${snap.rsi14.toFixed(1)} — momentum neutro`)
  }
  if (snap.macdHist !== null) {
    if (snap.macdHist > 0) { score += 12; signals.push('Histograma MACD positivo — aceleración compradora') }
    else { score -= 12; signals.push('Histograma MACD negativo — presión vendedora') }
  }
  if (snap.bbPosition !== null) {
    if (snap.bbPosition > 0.95) signals.push('Precio en banda superior de Bollinger — extensión')
    if (snap.bbPosition < 0.05) signals.push('Precio en banda inferior de Bollinger — compresión')
  }
  signals.push(`ATR ${snap.atrPct?.toFixed(2)}% — volatilidad ${snap.atrPct && snap.atrPct > 4 ? 'alta' : snap.atrPct && snap.atrPct < 1 ? 'baja' : 'normal'}`)
  if (snap.volumeTrend === 'rising') { score += 5; signals.push('Volumen creciente — confirma el movimiento') }
  if (snap.volumeTrend === 'falling') { score -= 3; signals.push('Volumen decreciente — movimiento sin convicción') }

  score += snap.momentumScore * 0.25
  const verdict = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral'
  const confidence = Math.min(0.95, Math.max(0.3, Math.abs(score) / 60))

  return {
    agentId: 'technical',
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    summary: `Vega: estructura ${snap.trend === 'up' ? 'alcista' : snap.trend === 'down' ? 'bajista' : 'lateral'}. Soporte ${snap.support.toPrecision(6)} / Resistencia ${snap.resistance.toPrecision(6)}. Score momentum ${snap.momentumScore > 0 ? '+' : ''}${snap.momentumScore}.`,
    signals,
  }
}

// ── Opinión determinista del explorador (Scout) ──────────────
function scoutOpinion(symbol: string, candles: Candle[], change24h: number): AgentOpinion {
  const closes = candles.map((c) => c.c)
  const ret5 = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100
  const ret20 = ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100
  const vol = candles.slice(-6).reduce((a, c) => a + c.v, 0) / 6
  const volAvg = candles.reduce((a, c) => a + c.v, 0) / candles.length
  const volSurge = vol / volAvg

  const signals: string[] = [
    `Retorno 24h ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
    `Retorno 5 velas ${ret5 >= 0 ? '+' : ''}${ret5.toFixed(2)}% · 20 velas ${ret20 >= 0 ? '+' : ''}${ret20.toFixed(2)}%`,
    `Volumen actual ${volSurge >= 1.2 ? 'dispara' : volSurge <= 0.7 ? 'se apaga' : 'estable'} (×${volSurge.toFixed(2)} sobre media)`,
  ]

  let score = 0
  score += Math.max(-20, Math.min(20, change24h * 1.2))
  score += Math.max(-15, Math.min(15, ret20 * 0.8))
  if (volSurge > 1.3 && ret5 > 0) { score += 10; signals.push('Explosión de volumen con precio al alza — interés real') }
  if (volSurge > 1.3 && ret5 < 0) { score -= 10; signals.push('Volumen alto con caída — distribución posible') }

  const verdict = score > 12 ? 'bullish' : score < -12 ? 'bearish' : 'neutral'
  return {
    agentId: 'market-scout',
    verdict,
    confidence: Math.round(Math.min(0.9, Math.abs(score) / 40) * 100) / 100,
    summary: `Scout: ${symbol} muestra ${score > 12 ? 'fuerza relativa' : score < -12 ? 'debilidad relativa' : 'actividad normal'} frente al mercado.`,
    signals,
  }
}

// ── Síntesis de Atlas con LLM ────────────────────────────────
async function strategistSynthesis(symbol: string, snap: TechnicalSnapshot, opinions: AgentOpinion[], price: number): Promise<{ action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string }> {
  const memoryCtx = await buildMemoryContext(`${symbol} análisis`)
  const kbCtx = kbContextForQuery('momentum tendencia riesgo entrada')
  const bull = opinions.filter((o) => o.verdict === 'bullish').length
  const bear = opinions.filter((o) => o.verdict === 'bearish').length

  const prompt = `Analiza ${symbol} y sintetiza la decisión del comité.

DATOS DE MERCADO (deterministas):
- Precio: ${price}
- Tendencia: ${snap.trend} | Momentum: ${snap.momentumScore} | RSI: ${snap.rsi14?.toFixed(1)} | MACD hist: ${snap.macdHist?.toFixed(4)} | ATR: ${snap.atrPct?.toFixed(2)}%
- Soporte: ${snap.support} | Resistencia: ${snap.resistance}

COMITÉ (${bull} alcistas, ${bear} bajistas):
${opinions.map((o) => `${AGENT_PROFILES[o.agentId].name} [${o.verdict} ${(o.confidence * 100).toFixed(0)}%]: ${o.signals.join(' · ')}`).join('\n')}

MEMORIA DEL AGENTE:
${memoryCtx}
${kbCtx ? `\nCONOCIMIENTOS DE REFERENCIA:\n${kbCtx}` : ''}

Responde EXACTAMENTE en este formato:
ACCIÓN: BUY|SELL|HOLD
CONFIANZA: 0.0-1.0
PLAN: <3-5 frases con entrada sugerida, stop basado en ATR (${(snap.atrPct ?? 2).toFixed(2)}% por vela → stop a 2×ATR), objetivo y condición de invalidación. Si no hay confluencia, explica qué falta.`

  try {
    const result = await routeLLM({
      messages: [
        { role: 'system', content: AGENT_PROFILES.strategist.systemPrompt + ' Responde siempre en español, formato exacto solicitado.' },
        { role: 'user', content: prompt },
      ],
      task: 'summary',
      temperature: 0.25,
    })
    const content = result.content
    const action = /ACCIÓN:\s*(BUY|SELL|HOLD)/i.exec(content)?.[1]?.toLowerCase() as 'buy' | 'sell' | 'hold' ?? 'hold'
    const confidence = parseFloat(/CONFIANZA:\s*([\d.]+)/i.exec(content)?.[1] ?? '0.5')
    const plan = /PLAN:\s*([\s\S]+)$/i.exec(content)?.[1]?.trim() ?? content.trim()
    return {
      action: ['buy', 'sell'].includes(action) ? action : 'hold',
      confidence: Math.max(0, Math.min(1, confidence || 0.5)),
      reasoning: plan,
    }
  } catch {
    // fallback determinista si el LLM no está disponible
    const action = bull > bear ? 'buy' : bear > bull ? 'sell' : 'hold'
    return {
      action,
      confidence: 0.4,
      reasoning: `Síntesis local (LLM no disponible): ${bull} agentes alcistas vs ${bear} bajistas. ${action === 'buy' ? `Entrada cercana a ${price.toPrecision(6)}, stop 2×ATR bajo soporte, objetivo en resistencia.` : action === 'sell' ? 'Esperar confirmación de ruptura o rebote según tu horizonte.' : 'Sin confluencia suficiente — mantener.'}`,
    }
  }
}

// ── Pipeline completo ────────────────────────────────────────
export async function runAnalysisPipeline(symbol: string, cgId?: string): Promise<TradeDecision> {
  const [candlesRes, quote] = await Promise.all([
    getCandles(symbol, '1h', 220, cgId),
    cgId
      ? getCustomQuotes([{ id: cgId }]).then((qs) => qs.find((q) => q.symbol === symbol.toUpperCase()) ?? qs[0] ?? null)
      : getQuote(symbol),
  ])
  const candles: Candle[] = candlesRes.candles
  const snap = analyzeTechnicals(candles)
  const price = snap.price

  const opinions: AgentOpinion[] = [
    technicalOpinion(snap),
    scoutOpinion(symbol, candles, quote?.change24h ?? 0),
  ]

  // Síntesis del estratega
  const synthesis = await strategistSynthesis(symbol, snap, opinions, price)
  const decision: TradeDecision = {
    symbol,
    action: synthesis.action,
    confidence: synthesis.confidence,
    reasoning: synthesis.reasoning,
    opinions,
    riskApproved: false,
    riskNotes: [],
  }

  // Validación del Risk Engine (Aegis)
  const account = await db.paperAccount.findFirst()
  const capital = account ? account.cash : 10000
  if (synthesis.action !== 'hold') {
    const side = synthesis.action === 'buy' ? 'long' : 'short'
    const atrStop = (snap.atr14 ?? price * 0.02) * 2
    const check = await riskEngine.validateEntry({
      symbol,
      side,
      entryPrice: price,
      stopPrice: side === 'long' ? price - atrStop : price + atrStop,
      capital,
    })
    decision.riskApproved = check.approved
    decision.riskNotes = check.reasons
    decision.entry = price
    decision.stopLoss = side === 'long' ? price - atrStop : price + atrStop
    decision.takeProfit = side === 'long' ? price + atrStop * 3 : price - atrStop * 3
    decision.positionSizeUsd = check.riskUsd && check.suggestedQty ? check.suggestedQty * price : undefined
  } else {
    decision.riskApproved = false
    decision.riskNotes = ['Sin operación propuesta — sin validación de riesgo necesaria']
  }

  // Aprende en memoria
  await remember({
    kind: 'episodic',
    key: `${symbol}-analisis-reciente`,
    content: `${new Date().toISOString().slice(0, 16)} — Análisis ${symbol}: acción ${decision.action} (conf ${decision.confidence.toFixed(2)}), precio ${price.toPrecision(6)}, tendencia ${snap.trend}, RSI ${snap.rsi14?.toFixed(0)}`,
    importance: 0.5,
    tags: [symbol, decision.action],
  })

  // Persiste decisión
  await db.agentDecision.create({
    data: {
      symbol,
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      agents: JSON.stringify(opinions),
      riskCheck: JSON.stringify({ approved: decision.riskApproved, notes: decision.riskNotes }),
      executed: false,
    },
  })

  return decision
}
