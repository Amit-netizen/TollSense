/**
 * Tests for WebSocket hook utilities and Zustand store logic
 */

// ─── TripEvent parser tests ───────────────────────────────────────────────

interface TripEvent {
  type: string
  trip_id?: string
  origin?: string
  destination?: string
  status?: string
  timestamp: string
}

function parseTripEvent(raw: string): TripEvent | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

describe('TripEvent parsing', () => {
  it('parses valid trip_update event', () => {
    const raw = JSON.stringify({
      type: 'trip_update',
      trip_id: 'abc-123',
      origin: 'Mumbai',
      destination: 'Pune',
      status: 'completed',
      timestamp: '2025-01-01T10:00:00Z',
    })
    const event = parseTripEvent(raw)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('trip_update')
    expect(event!.origin).toBe('Mumbai')
    expect(event!.status).toBe('completed')
  })

  it('parses connected event', () => {
    const raw = JSON.stringify({
      type: 'connected',
      status: 'Live trip feed active',
      timestamp: '2025-01-01T10:00:00Z',
    })
    const event = parseTripEvent(raw)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('connected')
  })

  it('returns null for invalid JSON', () => {
    expect(parseTripEvent('not json')).toBeNull()
    expect(parseTripEvent('')).toBeNull()
    expect(parseTripEvent('{broken')).toBeNull()
  })

  it('handles missing optional fields', () => {
    const raw = JSON.stringify({ type: 'ping', timestamp: '2025-01-01T10:00:00Z' })
    const event = parseTripEvent(raw)
    expect(event).not.toBeNull()
    expect(event!.origin).toBeUndefined()
    expect(event!.status).toBeUndefined()
  })
})

// ─── Live event store logic ───────────────────────────────────────────────

function addLiveEvent(existing: TripEvent[], newEvent: TripEvent, maxLen = 50): TripEvent[] {
  return [newEvent, ...existing].slice(0, maxLen)
}

describe('Live event store', () => {
  const makeEvent = (n: number): TripEvent => ({
    type: 'trip_update',
    trip_id: `trip-${n}`,
    timestamp: new Date(n * 1000).toISOString(),
    status: 'completed',
  })

  it('prepends new events to list', () => {
    const existing = [makeEvent(1)]
    const updated = addLiveEvent(existing, makeEvent(2))
    expect(updated[0].trip_id).toBe('trip-2')
    expect(updated[1].trip_id).toBe('trip-1')
  })

  it('caps list at maxLen (50 default)', () => {
    const existing = Array.from({ length: 50 }, (_, i) => makeEvent(i))
    const updated = addLiveEvent(existing, makeEvent(99))
    expect(updated).toHaveLength(50)
    expect(updated[0].trip_id).toBe('trip-99')
  })

  it('works with empty list', () => {
    const updated = addLiveEvent([], makeEvent(1))
    expect(updated).toHaveLength(1)
    expect(updated[0].trip_id).toBe('trip-1')
  })

  it('custom maxLen is respected', () => {
    const existing = [makeEvent(1), makeEvent(2), makeEvent(3)]
    const updated = addLiveEvent(existing, makeEvent(4), 3)
    expect(updated).toHaveLength(3)
    expect(updated[0].trip_id).toBe('trip-4')
  })
})

// ─── WS URL construction ──────────────────────────────────────────────────

function buildWsUrl(base: string, path: string): string {
  return `${base}${path}`
}

describe('WebSocket URL', () => {
  it('builds correct WS URL', () => {
    expect(buildWsUrl('ws://localhost:8080', '/ws/trips')).toBe('ws://localhost:8080/ws/trips')
  })

  it('builds correct WSS URL for production', () => {
    expect(buildWsUrl('wss://api.tollsense.io', '/ws/trips')).toBe('wss://api.tollsense.io/ws/trips')
  })
})

// ─── Status color mapping ─────────────────────────────────────────────────

type StatusColor = 'green' | 'amber' | 'slate' | 'red'

function statusColor(status: string): StatusColor {
  const map: Record<string, StatusColor> = {
    completed:   'green',
    in_progress: 'amber',
    pending:     'slate',
    cancelled:   'red',
  }
  return map[status] ?? 'slate'
}

describe('Status color mapping', () => {
  it('maps completed to green', () => expect(statusColor('completed')).toBe('green'))
  it('maps in_progress to amber', () => expect(statusColor('in_progress')).toBe('amber'))
  it('maps pending to slate', () => expect(statusColor('pending')).toBe('slate'))
  it('maps cancelled to red', () => expect(statusColor('cancelled')).toBe('red'))
  it('maps unknown to slate (fallback)', () => expect(statusColor('bogus')).toBe('slate'))
})
