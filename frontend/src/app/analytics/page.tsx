'use client'

import { useEffect, useState } from 'react'
import { analyticsApi } from '@/lib/api'
import { SpendChart } from '@/components/charts/SpendChart'
import { CorridorChart } from '@/components/charts/CorridorChart'
import type { SpendDataPoint, Corridor, AnalyticsSummary } from '@/types'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [spend, setSpend] = useState<SpendDataPoint[]>([])
  const [corridors, setCorridors] = useState<Corridor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.summary(),
      analyticsApi.spend(),
      analyticsApi.corridors(),
    ]).then(([s, sp, c]) => {
      setSummary(s.data)
      setSpend(sp.data)
      setCorridors(c.data)
    }).finally(() => setLoading(false))
  }, [])

  const totalFuel = corridors.reduce((sum, c) => sum + c.avg_toll * c.trip_count * 0.65, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Toll spend trends and corridor analysis</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Trips',
            value: summary ? summary.total_trips.toLocaleString() : '—',
            sub: 'lifetime',
            color: 'text-blue-400',
          },
          {
            label: 'Total Toll Spend',
            value: summary ? `₹${(summary.total_toll_spend / 1000).toFixed(1)}k` : '—',
            sub: 'cumulative',
            color: 'text-brand-400',
          },
          {
            label: 'Avg Cost / Trip',
            value: summary ? `₹${summary.avg_cost_per_trip.toFixed(0)}` : '—',
            sub: 'toll only',
            color: 'text-amber-400',
          },
          {
            label: 'Flagged Corridors',
            value: summary ? summary.flagged_routes : '—',
            sub: '>₹400 toll threshold',
            color: 'text-red-400',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-2 ${kpi.color}`}>{loading ? '—' : kpi.value}</p>
            <p className="text-xs text-slate-600 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Spend chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Daily Toll Spend — 30 Day Trend</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sum of all toll amounts per day</p>
          </div>
          {spend.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-500">30-day total</p>
              <p className="text-sm font-bold text-brand-400">
                ₹{spend.reduce((s, d) => s + d.spend, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
        <div className="h-64">
          <SpendChart data={spend} loading={loading} />
        </div>
      </div>

      {/* Corridors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top 5 Corridors by Avg Toll</h2>
          <div className="h-64">
            <CorridorChart data={corridors} loading={loading} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white">Corridor Detail</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
                  <div className="h-4 bg-white/5 rounded flex-1" />
                  <div className="h-4 bg-white/5 rounded w-20" />
                </div>
              ))
            ) : corridors.map((c, i) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.trip_count} trips</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-amber-400">
                    ₹{c.avg_toll.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">avg toll</p>
                </div>
                {/* Spend bar */}
                <div className="w-16">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (c.avg_toll / Math.max(...corridors.map(x => x.avg_toll))) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
