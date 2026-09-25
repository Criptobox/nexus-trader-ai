'use client'

// ─────────────────────────────────────────────────────────────
// Gráfico de velas SVG custom (sin dependencias) + volumen
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { Candle } from '@/lib/types'

interface CandleChartProps {
  candles: Candle[]
  height?: number
  showVolume?: boolean
  overlays?: { sma20?: boolean; sma50?: boolean }
}

export function CandleChart({ candles, height = 260, showVolume = true, overlays = { sma20: true, sma50: true } }: CandleChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 360
  const H = height
  const padTop = 8
  const volH = showVolume ? H * 0.18 : 0
  const chartH = H - volH - padTop - 4

  const data = useMemo(() => candles.slice(-120), [candles])

  const stats = useMemo(() => {
    if (!data.length) return null
    const highs = data.map((c) => c.h)
    const lows = data.map((c) => c.l)
    const max = Math.max(...highs)
    const min = Math.min(...lows)
    const maxVol = Math.max(...data.map((c) => c.v))
    const closes = data.map((c) => c.c)
    return { max, min, maxVol, range: max - min || 1, closes }
  }, [data])

  if (!stats || data.length < 2) return <div className="h-40 animate-pulse rounded-xl bg-muted/40" />

  const step = W / data.length
  const bodyW = Math.max(1.5, step * 0.62)
  const y = (price: number) => padTop + ((stats.max - price) / stats.range) * chartH

  const smaSeries = (period: number) => {
    const out: (number | null)[] = []
    let sum = 0
    data.forEach((c, i) => {
      sum += c.c
      if (i >= period) sum -= data[i - period].c
      out.push(i >= period - 1 ? sum / period : null)
    })
    return out
  }

  const sma20 = overlays.sma20 ? smaSeries(20) : null
  const sma50 = overlays.sma50 ? smaSeries(50) : null

  const linePath = (series: (number | null)[]) => {
    let d = ''
    let started = false
    series.forEach((v, i) => {
      if (v === null) { started = false; return }
      const x = i * step + step / 2
      const yy = y(v)
      d += `${started ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)} `
      started = true
    })
    return d
  }

  const hovered = hover !== null ? data[hover] : null

  return (
    <div className="relative select-none" role="img" aria-label="Gráfico de velas">
      <svg
        viewBox={`0 0 ${W} ${H}`} className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          setHover(Math.min(data.length - 1, Math.max(0, Math.floor(x / step))))
        }}
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={padTop + chartH * f} y2={padTop + chartH * f}
            stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 4" />
        ))}

        {/* volumen */}
        {showVolume && data.map((c, i) => {
          const vh = (c.v / stats.maxVol) * (volH - 6)
          return (
            <rect key={`v${i}`} x={i * step + (step - bodyW) / 2} y={H - 4 - vh}
              width={bodyW} height={Math.max(vh, 0.5)} rx={0.5}
              fill={c.c >= c.o ? '#10B981' : '#EF4444'} opacity="0.25" />
          )
        })}

        {/* velas */}
        {data.map((c, i) => {
          const up = c.c >= c.o
          const color = up ? '#10B981' : '#EF4444'
          const x = i * step + step / 2
          const yo = y(c.o), yc = y(c.c)
          const top = Math.min(yo, yc)
          const bh = Math.max(Math.abs(yc - yo), 1)
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
              <rect x={x - bodyW / 2} y={top} width={bodyW} height={bh} rx={0.8} fill={color} />
            </g>
          )
        })}

        {/* medias móviles */}
        {sma20 && <path d={linePath(sma20)} fill="none" stroke="#F59E0B" strokeWidth={1.4} opacity={0.9} />}
        {sma50 && <path d={linePath(sma50)} fill="none" stroke="#A78BFA" strokeWidth={1.4} opacity={0.9} />}

        {/* crosshair */}
        {hover !== null && (
          <line x1={hover * step + step / 2} x2={hover * step + step / 2} y1={padTop} y2={H - 4}
            stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 3" />
        )}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-white backdrop-blur">
          <div className="font-mono">
            O {hovered.o.toPrecision(6)} · H {hovered.h.toPrecision(6)}
          </div>
          <div className="font-mono">
            L {hovered.l.toPrecision(6)} · C <span className={hovered.c >= hovered.o ? 'text-emerald-400' : 'text-red-400'}>{hovered.c.toPrecision(6)}</span>
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-amber-500" /> SMA20</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-violet-400" /> SMA50</span>
      </div>
    </div>
  )
}

export function Sparkline({ values, up, width = 72, height = 28 }: { values: number[]; up: boolean; width?: number; height?: number }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
  const color = up ? '#10B981' : '#EF4444'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <polygon
        points={`0,${height} ${pts.join(' ')} ${width},${height}`}
        fill={color} opacity={0.12}
      />
    </svg>
  )
}
