/**
 * Tests for API client utilities - token handling, pagination, error handling
 */

// ─── Token extraction from localStorage ─────────────────────────────────

function extractBearerToken(header: string | null): string | null {
  if (!header) return null
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null
  return parts[1]
}

describe('Bearer token extraction', () => {
  it('extracts token from valid header', () => {
    expect(extractBearerToken('Bearer mytoken123')).toBe('mytoken123')
  })

  it('is case-insensitive for Bearer prefix', () => {
    expect(extractBearerToken('bearer mytoken123')).toBe('mytoken123')
    expect(extractBearerToken('BEARER mytoken123')).toBe('mytoken123')
  })

  it('returns null for missing header', () => {
    expect(extractBearerToken(null)).toBeNull()
    expect(extractBearerToken('')).toBeNull()
  })

  it('returns null for malformed header', () => {
    expect(extractBearerToken('NotBearer token')).toBeNull()
    expect(extractBearerToken('tokenonly')).toBeNull()
    expect(extractBearerToken('Too many parts here abc')).toBeNull()
  })
})

// ─── API error message extractor ─────────────────────────────────────────

interface ApiError {
  response?: { data?: { error?: string }; status?: number }
  message?: string
}

function extractErrorMessage(err: ApiError, fallback = 'An error occurred'): string {
  return err.response?.data?.error ?? err.message ?? fallback
}

describe('API error extraction', () => {
  it('extracts error from response.data.error', () => {
    const err = { response: { data: { error: 'Invalid credentials' }, status: 401 } }
    expect(extractErrorMessage(err)).toBe('Invalid credentials')
  })

  it('falls back to err.message', () => {
    const err = { message: 'Network error' }
    expect(extractErrorMessage(err)).toBe('Network error')
  })

  it('falls back to provided fallback string', () => {
    expect(extractErrorMessage({})).toBe('An error occurred')
    expect(extractErrorMessage({}, 'Custom fallback')).toBe('Custom fallback')
  })
})

// ─── Query param builder ──────────────────────────────────────────────────

function buildParams(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return entries.length ? `?${entries.join('&')}` : ''
}

describe('Query param builder', () => {
  it('builds params string', () => {
    const p = buildParams({ page: 1, per_page: 20 })
    expect(p).toContain('page=1')
    expect(p).toContain('per_page=20')
  })

  it('omits undefined values', () => {
    const p = buildParams({ page: 1, status: undefined })
    expect(p).toContain('page=1')
    expect(p).not.toContain('status')
  })

  it('omits empty string values', () => {
    const p = buildParams({ page: 1, status: '' })
    expect(p).not.toContain('status')
  })

  it('returns empty string for all-empty params', () => {
    expect(buildParams({})).toBe('')
    expect(buildParams({ status: undefined })).toBe('')
  })

  it('returns single param without &', () => {
    const p = buildParams({ page: 1 })
    expect(p).toBe('?page=1')
  })
})

// ─── Date formatter for display ───────────────────────────────────────────

function formatDate(iso: string): string {
  const date = new Date(iso)

  if (isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

describe('Date formatter', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2025-01-15T10:00:00Z')
    expect(result).toMatch(/Jan|15|2025/)
  })

  it('handles invalid date gracefully', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })
})

// ─── INR formatter ────────────────────────────────────────────────────────

function formatINR(n: number, decimals = 0): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`
}

describe('INR formatter', () => {
  it('formats whole numbers', () => {
    const r = formatINR(1234)
    expect(r).toContain('₹')
    expect(r).toContain('1')
  })

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0')
  })

  it('respects decimal places', () => {
    const r = formatINR(1234.56, 2)
    expect(r).toContain('.')
  })

  it('large numbers contain the digits', () => {
    const r = formatINR(100000)
    expect(r).toContain('₹')
    // Just verify it has the right digits (locale formatting varies)
    expect(r.replace(/[₹,]/g, '')).toContain('100000')
  })
})
