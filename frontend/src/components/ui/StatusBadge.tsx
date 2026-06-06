import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const config: Record<string, { classes: string; dot: string; label: string }> = {
  completed:   { classes: 'badge-green',  dot: 'bg-brand-400', label: 'Completed' },
  in_progress: { classes: 'badge-yellow', dot: 'bg-amber-400', label: 'In Progress' },
  pending:     { classes: 'badge-gray',   dot: 'bg-slate-400', label: 'Pending' },
  cancelled:   { classes: 'badge-red',    dot: 'bg-red-400',   label: 'Cancelled' },
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const c = config[status] ?? config.pending
  return (
    <span className={clsx(c.classes, size === 'md' && 'text-sm px-2.5 py-1')}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

export function FlaggedBadge() {
  return (
    <span className="badge-red">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Flagged
    </span>
  )
}
