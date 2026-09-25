// ─────────────────────────────────────────────────────────────
// Radar de Oportunidades — el "ascensor financiero" de NEXUS
// Escanea el mercado (principales + tendencias globales +
// monedas del usuario) y puntuá cada activo 0-100 combinando:
//   · momentum 24h          · tendencia 7d
//   · volumen relativo      · fuerza vs máximo 24h
//   · volatilidad (penalización) · calor de tendencias
// Genera tesis de inversión en español + nivel de riesgo y
// una recomendación narrada por el avatar.
// NO es asesoramiento financiero — herramienta educativa.
// ─────────────────────────────────────────────────────────────
import type { Quote } from '@/lib/types'
import { getQuotes } from '@/lib/market/data'
import { getCustomQuotes, getTrendingCoins, type TrendingCoin } from '@/lib/market/custom'

export type OpportunityType = 'EMERGENTE' | 'IMPULSO' | 'TENDENCIA' | 'REVERSION' | 'ESTABLE'
export type OpportunityAction = 'ZONA DE INTERÉS' | 'VIGILAR' | 'OBSERVAR' | 'EVITAR'
export type OpportunityRisk = 'bajo' | 'medio' | 'alto'

export interface Opportunity {
  symbol: string
  name: string
  score: number                 // 0-100
  type: OpportunityType
  action: OpportunityAction
  risk: OpportunityRisk
  thesis: string
  price: number
  momentum24h: number           // % 24h
  trend7d: number               // % 7d
  volume24h: number
  high24h: number
  imageUrl?: string
  trendingRank?: number
  isCustom?: boolean            // añadida por el usuario
  coingeckoId?: string          // id CG para handoff directo al chat
}

export interface RadarResult {
  generatedAt: string
  source: 'binance' | 'demo' | 'coingecko' | 'mixto'
  trendingCount: number
  scanned: number
  advice: string
  top: Opportunity | null
  opportunities: Opportunity[]
}

const MAJORS = new Set(['BTC', 'ETH'])

// desviación estándar de retornos del sparkline (volatilidad)
function volatility(spark: number[]): number {
  if (spark.length < 3) return 0
  const rets: number[] = []
  for (let i = 1; i < spark.length; i++) {
    if (spark[i - 1] > 0) rets.push((spark[i] - spark[i - 1]) / spark[i - 1])
  }
  if (rets.length < 2) return 0
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  return Math.sqrt(variance)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const fmt = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`
const fmtPrice = (p: number) => (p >= 1 ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `$${p.toPrecision(3)}`)
const fmtVol = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`

function classify(q: Quote, trendingRank?: number): OpportunityType {
  if (trendingRank) return 'EMERGENTE'
  if (q.change24h < -8) return 'REVERSION'
  if (q.change24h > 5) return 'IMPULSO'
  if (q.change7d > 8 && Math.abs(q.change24h) <= 5) return 'TENDENCIA'
  return 'ESTABLE'
}

function riskOf(type: OpportunityType, vol: number, isMajor: boolean): OpportunityRisk {
  if (type === 'REVERSION' || type === 'EMERGENTE') return 'alto'
  if (type === 'IMPULSO' || vol > 0.028) return 'medio'
  if (type === 'TENDENCIA') return 'medio'
  return isMajor ? 'bajo' : 'medio'
}

function actionOf(type: OpportunityType, score: number, momentum: number, risk: OpportunityRisk): OpportunityAction {
  if (type === 'REVERSION') return 'EVITAR'
  if (score >= 66) {
    if (risk === 'alto') return 'VIGILAR'
    if (momentum > 0.5) return 'ZONA DE INTERÉS'
    return 'VIGILAR'
  }
  return 'OBSERVAR'
}

// tesis narrada con los datos reales del escaneo
function buildThesis(q: Quote, type: OpportunityType, vol: number, trendingRank?: number, name?: string): string {
  const label = name ?? q.symbol
  const near = q.high24h > 0 ? (q.price / q.high24h) * 100 : 100
  const volTxt = fmtVol(q.volume24h)
  switch (type) {
    case 'EMERGENTE':
      return `${label} está entre los proyectos más buscados del momento (puesto #${trendingRank} en tendencias globales)${q.change24h !== 0 ? ` con ${fmt(q.change24h)} en 24 h` : ''}. Volumen de ${volTxt}. Capitalización pequeña: puede multiplicarse, pero también caer fuerte — posición reducida y stop obligatorio.`
    case 'IMPULSO':
      return `${label} gana ${fmt(q.change24h)} en 24 h con volumen de ${volTxt} y cotiza al ${near.toFixed(0)}% de su máximo del día (${fmtPrice(q.high24h)}). El momentum acompaña: el comité vigila continuación, con retroceso hacia la zona de ${fmtPrice(q.low24h)} como punto de entrada más seguro.`
    case 'TENDENCIA':
      return `${label} acumula ${fmt(q.change7d)} en 7 días con un día tranquilo (${fmt(q.change24h)} hoy). Tendencia ordenada, sin sobrecalentamiento: el plan sería escalonar entradas mientras sostenga la estructura alcista.`
    case 'REVERSION':
      return `${label} cae ${fmt(q.change24h)} en 24 h con volatilidad elevada. Hay sangre en las calles, pero coger cuchillos cayendo es mala idea: el comité prefiere esperar una señal de estabilización antes de valorar reversiones.`
    default: {
      const volNote = vol > 0.028 ? 'con volatilidad notable' : 'con volatilidad contenida'
      return `${label} se mueve ${fmt(q.change24h)} hoy (${fmt(q.change7d)} semanal) ${volNote}. Sin señal clara: correcto mantenerlo en observación dentro de una cartera diversificada.`
    }
  }
}

function scoreQuote(
  q: Quote,
  volRank: number,             // 0-1 dentro del pool
  trendingRank?: number,
  name?: string,
): Opportunity {
  const type = classify(q, trendingRank)
  const vol = volatility(q.spark)
  const isMajor = MAJORS.has(q.symbol)
  const risk = riskOf(type, vol, isMajor)

  // componentes 0-1
  const momentum = clamp01(0.5 + q.change24h / 20)
  const trend = clamp01(0.5 + q.change7d / 30)
  const highProx = q.high24h > 0 ? clamp01((q.price / q.high24h) * 0.85) : 0.5
  const volPenalty = clamp01(vol / 0.06)

  let score =
    0.32 * momentum +
    0.24 * trend +
    0.18 * volRank +
    0.14 * highProx +
    0.12 * (1 - volPenalty)
  if (trendingRank) score += 0.08 - (trendingRank - 1) * 0.01 // calor de tendencias
  if (isMajor) score += 0.03                                   // estabilidad sistémica
  // descuento por incertidumbre: riesgo alto nunca puntúa al máximo
  if (risk === 'alto') score *= 0.86
  else if (risk === 'medio') score *= 0.95
  const final = Math.round(clamp01(score) * 100)

  return {
    symbol: q.symbol,
    name: name ?? q.name ?? q.symbol,
    score: final,
    type,
    action: actionOf(type, final, momentum, risk),
    risk,
    thesis: buildThesis(q, type, vol, trendingRank, name),
    price: q.price,
    momentum24h: q.change24h,
    trend7d: q.change7d,
    volume24h: q.volume24h,
    high24h: q.high24h,
    imageUrl: q.imageUrl,
    trendingRank,
    isCustom: q.source === 'coingecko',
    coingeckoId: q.coingeckoId,
  }
}

function buildAdvice(top: Opportunity, second: Opportunity | null): string {
  const parts: string[] = []
  if (top.action === 'ZONA DE INTERÉS' || top.action === 'VIGILAR') {
    parts.push(
      `Mi mejor lectura ahora es ${top.symbol}: puntuación ${top.score}/100 y ${fmt(top.momentum24h)} en las últimas 24 horas.`,
    )
    if (top.type === 'EMERGENTE') {
      parts.push(`Es de los proyectos nuevos con más atención del mercado — si entras, hazlo con posición pequeña y stop definido.`)
    } else {
      parts.push(`El momentum y el volumen acompañan, así que la zona cerca de ${fmtPrice(top.high24h)} es la referencia a vigilar.`)
    }
  } else if (top.action === 'EVITAR') {
    parts.push(
      `Hoy no me gusta arriesgar: ${top.symbol} cae ${fmt(top.momentum24h)} con volatilidad alta. Mejor capital preservado que entradas forzadas.`,
    )
  } else {
    parts.push(
      `El mercado no grita ninguna oportunidad urgente. Lo más interesante es ${top.symbol} (${top.score}/100, ${fmt(top.momentum24h)}), pero sin confirmación todavía.`,
    )
  }
  if (second && second.symbol !== top.symbol) {
    parts.push(`También tengo en el radar ${second.symbol} (${second.score}/100). Recuerda: diversifica, usa stop-loss y solo arriesga lo que puedas permitirte perder.`)
  } else {
    parts.push(`Recuerda: stop-loss siempre y solo arriesga lo que puedas permitirte perder.`)
  }
  return parts.join(' ')
}

export async function scanOpportunities(customIds: { id: string }[] = []): Promise<RadarResult> {
  // 1) principales (Binance/demo) + tendencias globales (CoinGecko) en paralelo
  const [base, trending] = await Promise.all([
    getQuotes(),
    getTrendingCoins().catch(() => [] as TrendingCoin[]),
  ])

  // 2) cotizaciones externas: monedas del usuario (con sparkline,
  //    son pocas) y tendencias globales (sin sparkline → respuesta
  //    ligera, más resistente al rate limit de CoinGecko)
  const baseSymbols = new Set(base.quotes.map((q) => q.symbol))
  const trendingExtra = trending.filter((t) => !baseSymbols.has(t.symbol))
  const [userQuotes, trendQuotes] = await Promise.all([
    getCustomQuotes(customIds.filter((c) => !baseSymbols.has(c.id.toUpperCase())), { sparkline: true }).catch(() => [] as Quote[]),
    getCustomQuotes(trendingExtra.map((t) => ({ id: t.id })), { sparkline: false }).catch(() => [] as Quote[]),
  ])
  const customQuotes = [...userQuotes, ...trendQuotes]
  const byCgId = new Map(customQuotes.map((q) => [q.coingeckoId ?? q.symbol, q]))
  const bySymbol = new Map(customQuotes.map((q) => [q.symbol, q]))

  // 3) pool combinado
  const pool: Quote[] = [...base.quotes]

  // monedas del usuario añadidas al radar (van siempre)
  for (const c of customIds) {
    const q =
      byCgId.get(c.id) ??
      bySymbol.get(c.id.toUpperCase()) ??
      customQuotes.find((q) => (q.coingeckoId ?? '').toLowerCase() === c.id.toLowerCase())
    if (q && !pool.some((p) => p.symbol === q.symbol)) pool.push(q)
  }

  // tendencias globales no cubiertas (proyectos nuevos calientes)
  for (const t of trendingExtra) {
    const q = byCgId.get(t.id) ?? bySymbol.get(t.symbol)
    if (q && !pool.some((p) => p.symbol === q.symbol)) pool.push(q)
  }

  // 4) volumen relativo dentro del pool
  const vols = pool.map((q) => q.volume24h).sort((a, b) => a - b)
  const volRankOf = (v: number) => {
    if (vols.length < 2) return 0.5
    const idx = vols.indexOf(v)
    return vols.length > 1 ? idx / (vols.length - 1) : 0.5
  }

  // 5) puntuación
  const scored = pool.map((q) => {
    const t = trending.find((x) => x.symbol === q.symbol)
    return scoreQuote(q, volRankOf(q.volume24h), t?.rank, t?.name ?? q.name)
  })

  // deduplicar por símbolo y ordenar
  const seen = new Set<string>()
  const ranked = scored
    .filter((o) => (seen.has(o.symbol) ? false : (seen.add(o.symbol), true)))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0] ?? null
  const sources = new Set(pool.map((q) => q.source))
  const source: RadarResult['source'] =
    sources.size > 1 ? 'mixto' : (sources.values().next().value ?? 'demo')

  return {
    generatedAt: new Date().toISOString(),
    source,
    trendingCount: trending.length,
    scanned: pool.length,
    advice: top ? buildAdvice(top, ranked[1] ?? null) : 'Sin datos de mercado disponibles en este momento. Revisa tu conexión y vuelve a escanear.',
    top,
    opportunities: ranked.slice(0, 6),
  }
}
