// ─────────────────────────────────────────────────────────────
// Metadatos de criptomonedas con colores de marca oficiales
// ─────────────────────────────────────────────────────────────
import type { CoinMeta } from '@/lib/types'

export const COINS: CoinMeta[] = [
  { symbol: 'BTC',  name: 'Bitcoin',   coingecko: 'bitcoin',      color: '#F7931A', category: 'layer1' },
  { symbol: 'ETH',  name: 'Ethereum',  coingecko: 'ethereum',     color: '#627EEA', category: 'layer1' },
  { symbol: 'SOL',  name: 'Solana',    coingecko: 'solana',       color: '#9945FF', category: 'layer1' },
  { symbol: 'BNB',  name: 'BNB',       coingecko: 'binancecoin',  color: '#F3BA2F', category: 'exchange' },
  { symbol: 'XRP',  name: 'XRP',       coingecko: 'ripple',       color: '#23292F', category: 'layer1' },
  { symbol: 'ADA',  name: 'Cardano',   coingecko: 'cardano',      color: '#0033AD', category: 'layer1' },
  { symbol: 'DOGE', name: 'Dogecoin',  coingecko: 'dogecoin',     color: '#C2A633', category: 'meme' },
  { symbol: 'AVAX', name: 'Avalanche', coingecko: 'avalanche-2',  color: '#E84142', category: 'layer1' },
  { symbol: 'LINK', name: 'Chainlink', coingecko: 'chainlink',    color: '#2A5ADA', category: 'oracle' },
  { symbol: 'DOT',  name: 'Polkadot',  coingecko: 'polkadot',     color: '#E6007A', category: 'layer1' },
  { symbol: 'MATIC',name: 'Polygon',   coingecko: 'matic-network',color: '#8247E5', category: 'layer2' },
  { symbol: 'LTC',  name: 'Litecoin',  coingecko: 'litecoin',     color: '#345D9D', category: 'layer1' },
  { symbol: 'ATOM', name: 'Cosmos',    coingecko: 'cosmos',       color: '#2E3148', category: 'layer1' },
  { symbol: 'UNI',  name: 'Uniswap',   coingecko: 'uniswap',      color: '#FF007A', category: 'defi' },
  { symbol: 'TON',  name: 'Toncoin',   coingecko: 'the-open-network', color: '#0098EA', category: 'layer1' },
  { symbol: 'TRX',  name: 'TRON',      coingecko: 'tron',         color: '#EF0027', category: 'layer1' },
  { symbol: 'SHIB', name: 'Shiba Inu', coingecko: 'shiba-inu',    color: '#FFA409', category: 'meme' },
  { symbol: 'ARB',  name: 'Arbitrum',  coingecko: 'arbitrum',     color: '#28A0F0', category: 'layer2' },
  { symbol: 'OP',   name: 'Optimism',  coingecko: 'optimism',     color: '#FF0420', category: 'layer2' },
  { symbol: 'APT',  name: 'Aptos',     coingecko: 'aptos',        color: '#06B6D4', category: 'layer1' },
]

export const coinBySymbol = (symbol: string): CoinMeta | undefined =>
  COINS.find((c) => c.symbol === symbol.toUpperCase())

export const coinPair = (symbol: string) => `${symbol.toUpperCase()}USDT`
