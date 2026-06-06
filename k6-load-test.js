/**
 * TollSense k6 Load Test Suite
 * 
 * Install k6: https://k6.io/docs/get-started/installation/
 *   macOS:   brew install k6
 *   Linux:   sudo apt install k6
 *   Docker:  docker run grafana/k6 run - < k6-load-test.js
 *
 * Run:
 *   k6 run k6-load-test.js                         # smoke (default)
 *   k6 run -e SCENARIO=load k6-load-test.js         # load test
 *   k6 run -e SCENARIO=stress k6-load-test.js       # stress test
 *   k6 run -e SCENARIO=spike k6-load-test.js        # spike test
 *   k6 run -e SCENARIO=soak k6-load-test.js         # soak test (10min)
 *   k6 run --out json=results.json k6-load-test.js  # save results
 */

import http from 'k6/http'
import ws from 'k6/ws'
import { check, group, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'
const WS_URL   = __ENV.WS_URL   || 'ws://localhost:8080'
const SCENARIO = __ENV.SCENARIO || 'smoke'

// Custom metrics
const tripUploadDuration = new Trend('trip_upload_duration')
const analyticsDuration  = new Trend('analytics_duration')
const wsConnectRate      = new Rate('ws_connect_success')
const csvUploadErrors    = new Counter('csv_upload_errors')

// ─── Scenario Configs ────────────────────────────────────────────────────────

const scenarios = {
  smoke: {
    vus: 1,
    duration: '1m',
    thresholds: {
      http_req_failed:   ['rate<0.01'],
      http_req_duration: ['p(95)<300'],
    },
  },
  load: {
    stages: [
      { duration: '1m',  target: 10  },   // warm up
      { duration: '3m',  target: 50  },   // ramp to 50 VUs
      { duration: '5m',  target: 50  },   // hold
      { duration: '1m',  target: 0   },   // ramp down
    ],
    thresholds: {
      http_req_failed:        ['rate<0.01'],
      http_req_duration:      ['p(95)<500', 'p(99)<1000'],
      analytics_duration:     ['p(95)<400'],
      trip_upload_duration:   ['p(95)<800'],
    },
  },
  stress: {
    stages: [
      { duration: '1m',  target: 50  },
      { duration: '2m',  target: 100 },
      { duration: '2m',  target: 200 },
      { duration: '2m',  target: 200 },
      { duration: '1m',  target: 0   },
    ],
    thresholds: {
      http_req_failed:   ['rate<0.05'],       // allow 5% under stress
      http_req_duration: ['p(95)<2000'],
    },
  },
  spike: {
    stages: [
      { duration: '30s', target: 5   },       // baseline
      { duration: '15s', target: 200 },       // sudden spike
      { duration: '1m',  target: 200 },       // hold spike
      { duration: '15s', target: 5   },       // drop back
      { duration: '1m',  target: 5   },       // recovery
    ],
    thresholds: {
      http_req_failed:   ['rate<0.1'],
      http_req_duration: ['p(95)<3000'],
    },
  },
  soak: {
    stages: [
      { duration: '2m',  target: 20 },
      { duration: '8m',  target: 20 },
      { duration: '2m',  target: 0  },
    ],
    thresholds: {
      http_req_failed:   ['rate<0.01'],
      http_req_duration: ['p(95)<500'],
    },
  },
}

const cfg = scenarios[SCENARIO]
export const options = {
  stages:     cfg.stages,
  vus:        cfg.vus,
  duration:   cfg.duration,
  thresholds: cfg.thresholds,
}

// ─── Setup — Login once, share token ─────────────────────────────────────────

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'admin@tollsense.io', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(res, {
    'login status 200':      r => r.status === 200,
    'access token present':  r => !!r.json('access_token'),
    'refresh token present': r => !!r.json('refresh_token'),
  })

  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${res.body}`)
  }

  return {
    token:    res.json('access_token'),
    trip_id:  null,   // will be populated during test
  }
}

// ─── Default function — main VU loop ─────────────────────────────────────────

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type':  'application/json',
  }

  // Each VU cycles through realistic user journeys
  const journey = Math.floor(Math.random() * 4)

  if (journey === 0) {
    journeyDashboard(headers)
  } else if (journey === 1) {
    journeyTrips(headers)
  } else if (journey === 2) {
    journeyAnalytics(headers)
  } else {
    journeyRouteDetail(headers)
  }

  sleep(1 + Math.random() * 2) // think time: 1–3s
}

// ─── User Journeys ────────────────────────────────────────────────────────────

function journeyDashboard(headers) {
  group('Dashboard Load', () => {
    const summary = http.get(`${BASE_URL}/api/analytics/summary`, { headers })
    check(summary, {
      'summary 200':  r => r.status === 200,
      'has total_trips': r => r.json('total_trips') !== undefined,
    })

    const spend = http.get(`${BASE_URL}/api/analytics/spend`, { headers })
    check(spend, { 'spend 200': r => r.status === 200 })

    const corridors = http.get(`${BASE_URL}/api/analytics/corridors`, { headers })
    check(corridors, { 'corridors 200': r => r.status === 200 })

    const trips = http.get(`${BASE_URL}/api/trips?page=1&per_page=5`, { headers })
    check(trips, { 'recent trips 200': r => r.status === 200 })
  })
}

function journeyTrips(headers) {
  group('Trips List + Filter', () => {
    // Unfiltered
    const all = http.get(`${BASE_URL}/api/trips?page=1&per_page=20`, { headers })
    check(all, {
      'trips 200':     r => r.status === 200,
      'has data array': r => Array.isArray(r.json('data')),
      'has total':      r => r.json('total') >= 0,
    })

    // Status filter
    const completed = http.get(`${BASE_URL}/api/trips?status=completed`, { headers })
    check(completed, { 'filtered trips 200': r => r.status === 200 })

    // Page 2
    const page2 = http.get(`${BASE_URL}/api/trips?page=2&per_page=10`, { headers })
    check(page2, { 'page 2 200': r => r.status === 200 })

    // Vehicles endpoint
    const vehicles = http.get(`${BASE_URL}/api/vehicles`, { headers })
    check(vehicles, {
      'vehicles 200':   r => r.status === 200,
      'has vehicles':   r => Array.isArray(r.json()) && r.json().length > 0,
    })
  })
}

function journeyAnalytics(headers) {
  group('Analytics', () => {
    const start = Date.now()

    const summary = http.get(`${BASE_URL}/api/analytics/summary`, { headers })
    const spend   = http.get(`${BASE_URL}/api/analytics/spend`,   { headers })
    const top     = http.get(`${BASE_URL}/api/analytics/corridors`, { headers })

    analyticsDuration.add(Date.now() - start)

    check(summary, { 'summary ok':   r => r.status === 200 })
    check(spend,   { 'spend ok':     r => r.status === 200 })
    check(top,     { 'corridors ok': r => r.status === 200 })

    // Validate summary shape
    if (summary.status === 200) {
      check(summary, {
        'total_trips is number':        r => typeof r.json('total_trips') === 'number',
        'total_toll_spend is number':   r => typeof r.json('total_toll_spend') === 'number',
        'avg_cost_per_trip is number':  r => typeof r.json('avg_cost_per_trip') === 'number',
        'flagged_routes is number':     r => typeof r.json('flagged_routes') === 'number',
      })
    }
  })
}

function journeyRouteDetail(headers) {
  group('Route Detail', () => {
    // First fetch a trip ID
    const trips = http.get(`${BASE_URL}/api/trips?per_page=1`, { headers })
    if (trips.status !== 200) return

    const data = trips.json('data')
    if (!data || !data.length) return

    const id = data[0].id

    // Get route
    const route = http.get(`${BASE_URL}/api/trips/${id}/route`, { headers })
    check(route, {
      'route 200':          r => r.status === 200,
      'has breakdown':      r => Array.isArray(r.json('breakdown')),
      'has fuel_stops':     r => Array.isArray(r.json('fuel_stops')),
      'estimate present':   r => !!r.json('estimate'),
    })

    // Get trip
    const trip = http.get(`${BASE_URL}/api/trips/${id}`, { headers })
    check(trip, {
      'trip 200':      r => r.status === 200,
      'has origin':    r => !!r.json('origin'),
      'has status':    r => !!r.json('status'),
    })
  })
}

// ─── Auth Regression Group (every 10th iteration) ───────────────────────────

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'results/load-summary.json': JSON.stringify(data),
  }
}

function textSummary(data, opts) {
  const { metrics } = data
  const lines = []
  lines.push('\n╔══════════════════════════════════════════╗')
  lines.push('║         TollSense Load Test Results       ║')
  lines.push('╚══════════════════════════════════════════╝\n')

  const fmt = (v) => v ? v.toFixed(2) : 'N/A'

  if (metrics.http_req_duration) {
    lines.push(`HTTP Request Duration:`)
    lines.push(`  avg: ${fmt(metrics.http_req_duration.values.avg)}ms`)
    lines.push(`  p95: ${fmt(metrics.http_req_duration.values['p(95)'])}ms`)
    lines.push(`  p99: ${fmt(metrics.http_req_duration.values['p(99)'])}ms`)
  }
  if (metrics.http_req_failed) {
    lines.push(`\nError Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`)
  }
  if (metrics.http_reqs) {
    lines.push(`Total Requests: ${metrics.http_reqs.values.count}`)
    lines.push(`Req/s: ${fmt(metrics.http_reqs.values.rate)}`)
  }
  lines.push('')
  return lines.join('\n')
}
