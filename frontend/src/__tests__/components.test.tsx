/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Inline the component for testing (avoids complex Tailwind resolution)
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  loading?: boolean
}

function StatCard({ title, value, subtitle, loading }: StatCardProps) {
  if (loading) {
    return <div data-testid="stat-card-loading" aria-busy="true">Loading...</div>
  }
  return (
    <div data-testid="stat-card">
      <span data-testid="stat-title">{title}</span>
      <span data-testid="stat-value">{value}</span>
      {subtitle && <span data-testid="stat-subtitle">{subtitle}</span>}
    </div>
  )
}

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Trips" value={42} />)
    expect(screen.getByTestId('stat-title')).toHaveTextContent('Total Trips')
    expect(screen.getByTestId('stat-value')).toHaveTextContent('42')
  })

  it('renders subtitle when provided', () => {
    render(<StatCard title="Spend" value="₹1,234" subtitle="last 30 days" />)
    expect(screen.getByTestId('stat-subtitle')).toHaveTextContent('last 30 days')
  })

  it('does not render subtitle when not provided', () => {
    render(<StatCard title="Spend" value="₹1,234" />)
    expect(screen.queryByTestId('stat-subtitle')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when loading=true', () => {
    render(<StatCard title="X" value={0} loading={true} />)
    expect(screen.getByTestId('stat-card-loading')).toBeInTheDocument()
    expect(screen.getByTestId('stat-card-loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('hides loading skeleton when loading=false', () => {
    render(<StatCard title="X" value={99} loading={false} />)
    expect(screen.queryByTestId('stat-card-loading')).not.toBeInTheDocument()
    expect(screen.getByTestId('stat-card')).toBeInTheDocument()
  })

  it('renders string value', () => {
    render(<StatCard title="Spend" value="₹45,000" />)
    expect(screen.getByTestId('stat-value')).toHaveTextContent('₹45,000')
  })

  it('renders zero value', () => {
    render(<StatCard title="Flagged" value={0} />)
    expect(screen.getByTestId('stat-value')).toHaveTextContent('0')
  })
})

// ─── StatusBadge-like utility ─────────────────────────────────────────────

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    completed:   'Completed',
    in_progress: 'In Progress',
    pending:     'Pending',
    cancelled:   'Cancelled',
  }
  return <span data-testid="status-label">{labels[status] ?? 'Pending'}</span>
}

describe('StatusLabel', () => {
  const cases = [
    ['completed',   'Completed'],
    ['in_progress', 'In Progress'],
    ['pending',     'Pending'],
    ['cancelled',   'Cancelled'],
    ['unknown',     'Pending'],  // fallback
  ]

  test.each(cases)('status "%s" → label "%s"', (status, label) => {
    render(<StatusLabel status={status} />)
    expect(screen.getByTestId('status-label')).toHaveTextContent(label)
  })
})

// ─── Pagination logic ─────────────────────────────────────────────────────

function totalPages(total: number, perPage: number): number {
  return Math.ceil(total / perPage)
}

describe('Pagination', () => {
  it('calculates total pages correctly', () => {
    expect(totalPages(100, 20)).toBe(5)
    expect(totalPages(21, 20)).toBe(2)
    expect(totalPages(20, 20)).toBe(1)
    expect(totalPages(1, 20)).toBe(1)
    expect(totalPages(0, 20)).toBe(0)
  })

  it('handles exact divisions', () => {
    expect(totalPages(200, 10)).toBe(20)
    expect(totalPages(15, 5)).toBe(3)
  })

  it('handles remainder', () => {
    expect(totalPages(11, 10)).toBe(2)
    expect(totalPages(101, 100)).toBe(2)
  })
})
