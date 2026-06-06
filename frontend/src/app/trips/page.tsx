'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { tripsApi } from '@/lib/api'
import type { Trip, PaginatedTrips } from '@/types'
import { StatusBadge, FlaggedBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import Papa from 'papaparse'

const STATUSES = ['', 'pending', 'in_progress', 'completed', 'cancelled']

export default function TripsPage() {
  const [data, setData] = useState<PaginatedTrips | null>(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTrips = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tripsApi.list(page, 20, status)
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setUploadResult(null)

    Papa.parse(file, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete: (result) => setCsvPreview(result.data as any[]),
    })
  }

  async function handleUpload() {
    if (!csvFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await tripsApi.upload(csvFile)
      setUploadResult(res.data)
      setCsvFile(null)
      setCsvPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchTrips()
    } catch (err: any) {
      setUploadResult({ inserted: 0, skipped: 0, errors: [err.response?.data?.error || 'Upload failed'] })
    } finally {
      setUploading(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Trips</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total.toLocaleString()} total trips` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Import Trips via CSV</h2>
        <div className="flex flex-col gap-4">
          {/* Format hint */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300/80 font-mono">
            Required columns: <span className="text-blue-300">origin, destination, vehicle_id, distance_km</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="btn-ghost cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {csvFile ? csvFile.name : 'Choose CSV file'}
            </label>
            {csvFile && (
              <button onClick={handleUpload} disabled={uploading} className="btn-primary">
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>
            )}
          </div>

          {/* CSV Preview */}
          {csvPreview && (
            <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {Object.keys(csvPreview[0] || {}).map(col => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-slate-400">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {Object.values(row as Record<string, string>).map((val, j) => (
                        <td key={j} className="px-3 py-2 text-slate-300 font-mono">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-500">Showing 3 of {csvPreview.length} preview rows</p>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div className={`rounded-lg p-3 text-sm border ${
              uploadResult.errors.length
                ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                : 'bg-brand-500/5 border-brand-500/20 text-brand-300'
            }`}>
              <p className="font-medium">
                ✅ {uploadResult.inserted} inserted · ⚠️ {uploadResult.skipped} skipped
              </p>
              {uploadResult.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs mt-1 text-slate-400">{e}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              status === s
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Distance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Toll</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.data.map(trip => (
                <tr key={trip.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {trip.origin} → {trip.destination}
                    </div>
                    {trip.flagged && <FlaggedBadge />}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <div>{trip.vehicle_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{trip.vehicle_class}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">{trip.distance_km} km</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white tabular-nums">
                      ₹{Number(trip.toll_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-slate-500">
                      +₹{Number(trip.fuel_cost ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} fuel
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={trip.status} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(trip.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/route/${trip.id}`}
                      className="text-xs text-brand-400 hover:text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {data.total} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs py-1 px-3 disabled:opacity-30"
              >← Prev</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost text-xs py-1 px-3 disabled:opacity-30"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
