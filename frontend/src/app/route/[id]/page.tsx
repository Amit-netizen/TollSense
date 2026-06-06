'use client'

import { useEffect, useState } from 'react'
import { tripsApi } from '@/lib/api'
import type { RouteDetail } from '@/types'
import { StatusBadge, FlaggedBadge } from '@/components/ui/StatusBadge'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const RouteMap = dynamic(
  () => import('@/components/map/RouteMap').then(m => m.RouteMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-900 rounded-xl flex items-center justify-center text-slate-500 text-sm">Loading map...</div> }
)

export default function RoutePage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<RouteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    tripsApi.getRoute(params.id)
      .then(res => setDetail(res.data))
      .catch(() => setError('Trip not found'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-white/5 rounded w-48" />
        <div className="h-96 bg-white/5 rounded-xl" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">{error || 'Trip not found'}</p>
        <Link href="/trips" className="btn-ghost text-sm">← Back to trips</Link>
      </div>
    )
  }

  const { trip, estimate, breakdown, fuel_stops } = detail
  const totalCost = estimate.toll_amount + estimate.fuel_cost

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/trips" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2 inline-flex items-center gap-1">
            ← Trips
          </Link>
          <h1 className="text-xl font-bold text-white">
            {trip.origin} → {trip.destination}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={trip.status} size="md" />
            {estimate.flagged && <FlaggedBadge />}
            <span className="text-xs text-slate-500 font-mono">{trip.id.slice(0, 8)}...</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-slate-500">total estimated cost</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Map */}
        <div className="lg:col-span-3 h-96 card overflow-hidden">
          <RouteMap
            origin={trip.origin}
            destination={trip.destination}
            tollBreakdowns={breakdown}
            fuelStops={fuel_stops}
            distanceKm={trip.distance_km}
          />
        </div>

        {/* Cost breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Cost Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500">Total Distance</p>
                  <p className="text-sm font-semibold text-white">{trip.distance_km} km</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Vehicle</p>
                  <p className="text-sm font-semibold text-white capitalize">{trip.vehicle_class}</p>
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Toll charges</span>
                  <span className="font-semibold text-white">₹{estimate.toll_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Fuel cost</span>
                  <span className="font-semibold text-white">₹{estimate.fuel_cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-brand-400">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fuel stops */}
          {fuel_stops.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Recommended Fuel Stops</h2>
              <div className="space-y-2">
                {fuel_stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 truncate">{stop.name}</p>
                    </div>
                    <span className="text-slate-500">₹{stop.price_per_l}/L</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toll plaza breakdown */}
      <div className="card">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Toll Plaza Breakdown</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {breakdown.map((plaza, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">{plaza.plaza_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">at {plaza.km} km</p>
              </div>
              <span className="font-semibold text-white tabular-nums">₹{plaza.amount}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01] flex justify-between items-center">
          <span className="text-sm text-slate-400">{breakdown.length} toll plazas</span>
          <span className="font-bold text-white">₹{estimate.toll_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  )
}
