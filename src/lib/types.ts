// ─────────────────────────────────────────────────────────────
// NEXUS Trader AI — Tipos compartidos del sistema
// ─────────────────────────────────────────────────────────────

export interface Candle {
  t: number // timestamp (ms)
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface CoinMeta {
  symbol: string       // BTC
  name: string         // Bitcoin
  coingecko: string    // bitcoin
  color: string        // color de marca
  category: 'layer1' | 'layer2' | 'defi' | 'meme' | 'stable' | 'oracle' | 'exchange'
}

export interface Quote {
  symbol: string
  name?: string         // nombre completo (monedas custom)
  price: number
  change24h: number    // %
  change7d: number     // %
  high24h: number
  low24h: number
  volume24h: number
  marketCap: number
  spark: number[]      // últimos ~24 puntos para sparkline
  source: 'binance' | 'demo' | 'coingecko'
  imageUrl?: string    // logo original oficial (CoinGecko)
  coingeckoId?: string // id para monedas personalizadas
}

export interface CustomCoin {
  id: string        // id de CoinGecko (ej. "pepe")
  symbol: string    // PEPE
  name: string      // Pepe
  image: string     // URL del logo original oficial
}

export type AgentId =
  | 'orchestrator'
  | 'technical'
  | 'market-scout'
  | 'risk-manager'
  | 'strategist'
  | 'educator'

export interface AgentProfile {
  id: AgentId
  name: string
  role: string
  specialty: string
  color: string        // color de acento del avatar
  gradient: [string, string]
  icon: string         // nombre de icono lucide
  systemPrompt: string
}

export interface AgentOpinion {
  agentId: AgentId
  verdict: 'bullish' | 'bearish' | 'neutral'
  confidence: number   // 0..1
  summary: string
  signals: string[]    // señales detectadas
}

export interface TradeDecision {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  confidence: number
  entry?: number
  stopLoss?: number
  takeProfit?: number
  positionSizeUsd?: number
  reasoning: string
  opinions: AgentOpinion[]
  riskApproved: boolean
  riskNotes: string[]
}

export interface RiskCheckResult {
  approved: boolean
  reasons: string[]
  suggestedQty?: number
  suggestedStop?: number
  suggestedTake?: number
  riskUsd?: number
  exposureAfter?: number
}

export interface BacktestMetrics {
  finalEquity: number
  totalReturnPct: number
  cagr: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
  winRate: number
  profitFactor: number
  totalTrades: number
  avgTradePct: number
  bestTradePct: number
  worstTradePct: number
  exposurePct: number
}

export interface BacktestTrade {
  entryTime: number
  exitTime: number
  side: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  qty: number
  pnl: number
  pnlPct: number
  reason: string
}

export interface EquityPoint {
  t: number
  equity: number
  drawdownPct: number
}

export type KillSwitchLevel = 'normal' | 'soft_stop' | 'full_stop'

export interface KillSwitchStatus {
  active: boolean
  level: KillSwitchLevel
  reason: string | null
  triggeredBy: string | null
  activatedAt: string | null
  autoResumeAt: string | null
}

export interface RouterProfile {
  id: string
  label: string
  provider: 'zai' | 'openai-compatible'
  model?: string        // undefined => modelo por defecto del SDK
  temperature?: number
  useFor: ('chat' | 'analysis' | 'summary')[]
  enabled: boolean
}

export interface LLMRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  task: 'chat' | 'analysis' | 'summary'
  temperature?: number
  maxTokens?: number
  json?: boolean
}
