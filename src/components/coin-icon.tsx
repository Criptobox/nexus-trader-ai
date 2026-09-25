'use client'

// ─────────────────────────────────────────────────────────────
// Logos de criptomonedas — prioridad: logo original oficial
// (monedas custom vía CoinGecko) → SVG inline con colores de
// marca originales. Fallback automático a moneda genérica.
// ─────────────────────────────────────────────────────────────
import { useAppStore } from '@/lib/store'

interface CoinIconProps {
  symbol: string
  size?: number
  className?: string
  src?: string // URL de logo original (sobrescribe todo)
}

const GRADIENTS: Record<string, { from: string; to: string }> = {
  BTC: { from: '#FFB74D', to: '#F7931A' },
  ETH: { from: '#8CA8F0', to: '#627EEA' },
  SOL: { from: '#B377FF', to: '#7C3AED' },
  BNB: { from: '#FFD466', to: '#F3BA2F' },
  XRP: { from: '#4A5560', to: '#23292F' },
  ADA: { from: '#2A66D6', to: '#0033AD' },
  DOGE: { from: '#E2C352', to: '#C2A633' },
  AVAX: { from: '#FF6B6C', to: '#E84142' },
  LINK: { from: '#5B85F0', to: '#2A5ADA' },
  DOT: { from: '#FF4D9E', to: '#E6007A' },
  MATIC: { from: '#A26CE8', to: '#8247E5' },
  LTC: { from: '#5D82C4', to: '#345D9D' },
  ATOM: { from: '#50566F', to: '#2E3148' },
  UNI: { from: '#FF509E', to: '#FF007A' },
  TON: { from: '#33B3F5', to: '#0098EA' },
  TRX: { from: '#FF3354', to: '#EF0027' },
  SHIB: { from: '#FFC056', to: '#FFA409' },
  ARB: { from: '#5CC0F5', to: '#28A0F0' },
  OP: { from: '#FF3B58', to: '#FF0420' },
  APT: { from: '#38D9F0', to: '#06B6D4' },
}

const GLYPHS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: '⬡', XRP: '✕', ADA: '₳',
  DOGE: 'Ð', AVAX: '▲', LINK: '⬡', DOT: '●', MATIC: '⬡', LTC: 'Ł',
  ATOM: '⚛', UNI: '🦄', TON: '◈', TRX: '▽', SHIB: '🐕', ARB: '◈',
  OP: '⬡', APT: 'ⓐ',
}

const TEXT_GLYPHS: Record<string, string> = {
  BNB: 'B', LINK: 'L', MATIC: 'P', UNI: 'U', OP: 'OP', APT: 'A', SHIB: 'S',
}

export function CoinIcon({ symbol, size = 36, className, src }: CoinIconProps) {
  const s = symbol.toUpperCase().replace('USDT', '')
  const custom = useAppStore((st) => st.customCoins.find((c) => c.symbol === s))
  const imageUrl = src ?? custom?.image

  // logo original oficial de la moneda (CoinGecko)
  if (imageUrl) {
    return (
       
      <img
        src={imageUrl}
        alt={`Logo ${s}`}
        width={size}
        height={size}
        loading="lazy"
        className={`rounded-full object-cover ${className ?? ''}`}
        style={{ width: size, height: size, flexShrink: 0, background: '#131A2A' }}
      />
    )
  }

  const grad = GRADIENTS[s] ?? { from: '#94A3B8', to: '#475569' }
  const gid = `cg-${s}`
  const glyph = TEXT_GLYPHS[s] ?? GLYPHS[s] ?? s.slice(0, 2)
  const isText = !!TEXT_GLYPHS[s] || !GLYPHS[s]
  const fontSize = s === 'OP' ? size * 0.32 : size * 0.48

  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      className={className}
      role="img" aria-label={`Logo ${s}`}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={grad.from} />
          <stop offset="100%" stopColor={grad.to} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${gid})`} />
      <circle cx="24" cy="24" r="23" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {s === 'ETH' ? (
        <g fill="white">
          <path d="M24 8 L33 24.5 L24 30 L15 24.5 Z" opacity="0.95" />
          <path d="M24 32.2 L33 26.5 L24 40 L15 26.5 Z" opacity="0.7" />
        </g>
      ) : s === 'XRP' ? (
        <g stroke="white" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M13 13 Q24 26 35 13" />
          <path d="M13 35 Q24 22 35 35" />
        </g>
      ) : s === 'SOL' ? (
        <g fill="white">
          <rect x="14" y="16" width="20" height="3.6" rx="1.8" transform="skewX(-8)" />
          <rect x="14" y="22.2" width="20" height="3.6" rx="1.8" transform="skewX(8)" />
          <rect x="14" y="28.4" width="20" height="3.6" rx="1.8" transform="skewX(-8)" />
        </g>
      ) : s === 'DOT' ? (
        <g fill="white">
          <circle cx="24" cy="14" r="4.4" />
          <circle cx="15" cy="30" r="4.4" />
          <circle cx="33" cy="30" r="4.4" />
        </g>
      ) : s === 'TON' ? (
        <g stroke="white" strokeWidth="3.4" fill="none" strokeLinejoin="round">
          <path d="M12 15 L36 15 L24 37 Z" />
          <path d="M12 15 L24 24 L36 15" />
        </g>
      ) : (
        <text
          x="24" y="24" textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={fontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {glyph}
        </text>
      )}
      {isText && (s === 'ETH' || s === 'XRP' || s === 'SOL' || s === 'DOT' || s === 'TON') ? null : null}
    </svg>
  )
}
