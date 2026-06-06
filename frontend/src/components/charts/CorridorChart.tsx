'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import type { Corridor } from '@/types'

interface CorridorChartProps {
  data: Corridor[]
  loading?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-amber-400">
        Avg ₹{Number(payload[0].value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs text-slate-500">{payload[0].payload.trip_count} trips</p>
    </div>
  )
}

const COLORS = ['#f59e0b', '#ef4444', '#f97316', '#eab308', '#f87171']

export function CorridorChart({ data, loading }: CorridorChartProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-slate-500">No data available</div>
      </div>
    )
  }

  const formatted = data.map(d => ({
    ...d,
    name: d.name.split(' → ').join('→'),
    short_name: d.name.split(' → ')[0],
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${v}`}
        />
        <YAxis
          type="category"
          dataKey="short_name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="avg_toll" radius={[0, 4, 4, 0]}>
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
