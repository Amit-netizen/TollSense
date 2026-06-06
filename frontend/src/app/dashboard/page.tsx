'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/StatCard'
import { SpendChart } from '@/components/charts/SpendChart'
import { CorridorChart } from '@/components/charts/CorridorChart'
import { analyticsApi, tripsApi } from '@/lib/api'
import type { AnalyticsSummary, SpendDataPoint, Corridor, Trip } from '@/types'
import { StatusBadge, FlaggedBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [spend, setSpend] = useState<SpendDataPoint[]>([])
  const [corridors, setCorridors] = useState<Corridor[]>([])
  const [recentTrips, setRecentTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [summaryRes, spendRes, corridorRes, tripsRes] = await Promise.all([
          analyticsApi.summary(),
          analyticsApi.spend(),
          analyticsApi.corridors(),
          tripsApi.list(1, 5),
        ])
        setSummary(summaryRes.data)
        setSpend(spendRes.data)
        setCorridors(corridorRes.data)
        setRecentTrips(tripsRes.data.data)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Fleet Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time toll & fuel analytics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Trips"
          value={summary ? fmt(summary.total_trips) : '—'}
          subtitle="all time"
          accent="blue"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
        />
        <StatCard
          title="Total Toll Spend"
          value={summary ? `₹${fmt(summary.total_toll_spend)}` : '—'}
          subtitle="cumulative"
          accent="green"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Avg Cost / Trip"
          value={summary ? `₹${fmt(summary.avg_cost_per_trip)}` : '—'}
          subtitle="toll only"
          accent="yellow"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Flagged Routes"
          value={summary ? summary.flagged_routes : '—'}
          subtitle="high toll corridors"
          accent="red"
          loading={loading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Spend over time */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Toll Spend — Last 30 Days</h2>
            <span className="text-xs text-slate-500">Daily total (₹)</span>
          </div>
          <div className="h-52">
            <SpendChart data={spend} loading={loading} />
          </div>
        </div>

        {/* Top corridors */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Top 5 Corridors</h2>
            <span className="text-xs text-slate-500">By avg toll (₹)</span>
          </div>
          <div className="h-52">
            <CorridorChart data={corridors} loading={loading} />
          </div>
        </div>
      </div>

      {/* Recent trips */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Recent Trips</h2>
          <Link href="/trips" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-white/5 rounded flex-1" />
                <div className="h-4 bg-white/5 rounded w-20" />
                <div className="h-4 bg-white/5 rounded w-16" />
              </div>
            ))
          ) : recentTrips.map((trip) => (
            <Link
              key={trip.id}
              href={`/route/${trip.id}`}
              className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate group-hover:text-brand-400 transition-colors">
                  {trip.origin} → {trip.destination}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{trip.vehicle_name} · {trip.distance_km} km</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {trip.flagged && <FlaggedBadge />}
                <StatusBadge status={trip.status} />
                {trip.toll_amount !== undefined && (
                  <span className="text-sm font-semibold text-white tabular-nums">
                    ₹{Number(trip.toll_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
