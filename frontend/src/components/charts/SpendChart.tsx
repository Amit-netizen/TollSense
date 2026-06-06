'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts'
import type { SpendDataPoint } from '@/types'

interface SpendChartProps {
  data: SpendDataPoint[]
  loading?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-brand-400">
        ₹{Number(payload[0].value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

export function SpendChart({ data, loading }: SpendChartProps) {
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
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="spend"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#spendGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#22c55e', stroke: '#0f172a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
