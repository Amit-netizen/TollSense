import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: { value: number; label: string }
  accent?: 'green' | 'red' | 'yellow' | 'blue'
  loading?: boolean
}

export function StatCard({ title, value, subtitle, icon, trend, accent = 'green', loading }: StatCardProps) {
  const accentClasses = {
    green: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }

  if (loading) {
    return (
      <div className="stat-card animate-pulse">
        <div className="h-4 bg-white/5 rounded w-24 mb-3" />
        <div className="h-8 bg-white/5 rounded w-32 mb-2" />
        <div className="h-3 bg-white/5 rounded w-20" />
      </div>
    )
  }

  return (
    <div className="stat-card card-hover">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center', accentClasses[accent])}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {trend && (
        <div className={clsx(
          'mt-2 flex items-center gap-1 text-xs',
          trend.value >= 0 ? 'text-brand-400' : 'text-red-400'
        )}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            {trend.value >= 0
              ? <path d="M6 2l4 4H8v4H4V6H2l4-4z" />
              : <path d="M6 10L2 6h2V2h4v4h2L6 10z" />
            }
          </svg>
          <span>{Math.abs(trend.value)}% {trend.label}</span>
        </div>
      )}
    </div>
  )
}
