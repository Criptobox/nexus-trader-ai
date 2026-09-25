'use client'

// Área chart simple con recharts para la curva de equity
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Point { t: string; equity: number }

export function AreaChartSimple({ data, up, height = 120 }: { data: Point[]; up: boolean; height?: number }) {
  const color = up ? '#10B981' : '#EF4444'
  const short = data.length > 60 ? data.filter((_, i) => i % Math.ceil(data.length / 60) === 0) : data
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={short} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`eq-${up ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,20,34,0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, fontSize: 11, color: '#E8ECF3',
          }}
          formatter={(v: number) => [`$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill={`url(#eq-${up ? 'up' : 'down'})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
