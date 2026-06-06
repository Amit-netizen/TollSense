#!/usr/bin/env bash
# TollSense Integration Test Suite
# Usage: ./test_integration.sh [BASE_URL]
# Default: http://localhost:8080

set -euo pipefail

BASE="${1:-http://localhost:8080}"
PASS=0
FAIL=0
SKIP=0
TOKEN=""
TRIP_ID=""

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RESET='\033[0m'; BOLD='\033[1m'

# ─── Helpers ─────────────────────────────────────────────────────────────────
pass() { echo -e "  ${GREEN}✔${RESET} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✘${RESET} $1"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}⊘${RESET} $1 (skipped)"; ((SKIP++)); }
section() { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then pass "$label → HTTP $actual"; else fail "$label → expected $expected got $actual"; fi
}

check_contains() {
  local label="$1" pattern="$2" body="$3"
  if echo "$body" | grep -q "$pattern"; then pass "$label"; else fail "$label (pattern '$pattern' not found)"; fi
}

# ─── Wait for backend ─────────────────────────────────────────────────────────
echo -e "${BOLD}TollSense Integration Tests${RESET}"
echo -e "Target: ${CYAN}${BASE}${RESET}\n"

echo -n "Waiting for backend..."
for i in {1..15}; do
  if curl -sf "${BASE}/health" > /dev/null 2>&1; then
    echo -e " ${GREEN}ready${RESET}"
    break
  fi
  echo -n "."
  sleep 2
  if [ $i -eq 15 ]; then
    echo -e "\n${RED}Backend not reachable at ${BASE}${RESET}"
    exit 1
  fi
done

# ─── 1. Health ────────────────────────────────────────────────────────────────
section "Health Check"
RES=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/health")
check_status "GET /health" "200" "$RES"

BODY=$(curl -s "${BASE}/health")
check_contains "Response has 'ok'" "ok" "$BODY"

# ─── 2. Auth ─────────────────────────────────────────────────────────────────
section "Authentication"

# Valid login
LOGIN=$(curl -s -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tollsense.io","password":"admin123"}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tollsense.io","password":"admin123"}')
check_status "POST /auth/login (valid)" "200" "$CODE"
check_contains "Has access_token" "access_token" "$LOGIN"
check_contains "Has refresh_token" "refresh_token" "$LOGIN"

TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  fail "Could not extract access token — remaining tests may fail"
else
  pass "Access token extracted (${#TOKEN} chars)"
fi

# Wrong password
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tollsense.io","password":"wrong"}')
check_status "POST /auth/login (wrong password)" "401" "$CODE"

# Missing fields
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tollsense.io"}')
check_status "POST /auth/login (missing password)" "400" "$CODE"

# ─── 3. Auth Guard ────────────────────────────────────────────────────────────
section "Auth Guard (protected routes)"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/trips")
check_status "GET /api/trips (no token)" "401" "$CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer invalid.token.here" "${BASE}/api/trips")
check_status "GET /api/trips (invalid token)" "401" "$CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: NotBearer $TOKEN" "${BASE}/api/trips")
check_status "GET /api/trips (wrong scheme)" "401" "$CODE"

# ─── 4. Trips ─────────────────────────────────────────────────────────────────
section "Trips API"

TRIPS=$(curl -s "${BASE}/api/trips?page=1&per_page=10" \
  -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/trips" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/trips" "200" "$CODE"
check_contains "Has data field" '"data"' "$TRIPS"
check_contains "Has total field" '"total"' "$TRIPS"
check_contains "Has page field" '"page"' "$TRIPS"

# Extract first trip ID
TRIP_ID=$(echo "$TRIPS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$TRIP_ID" ]; then
  pass "Extracted trip_id: ${TRIP_ID:0:8}..."
else
  skip "No trips found to test by ID"
fi

# Pagination
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE}/api/trips?page=2&per_page=5" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/trips?page=2" "200" "$CODE"

# Status filter
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE}/api/trips?status=completed" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/trips?status=completed" "200" "$CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE}/api/trips?status=in_progress" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/trips?status=in_progress" "200" "$CODE"

# Trip by ID
if [ -n "$TRIP_ID" ]; then
  TRIP=$(curl -s "${BASE}/api/trips/$TRIP_ID" \
    -H "Authorization: Bearer $TOKEN")
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE}/api/trips/$TRIP_ID" \
    -H "Authorization: Bearer $TOKEN")
  check_status "GET /api/trips/:id" "200" "$CODE"
  check_contains "Trip has origin" '"origin"' "$TRIP"
  check_contains "Trip has status" '"status"' "$TRIP"
fi

# 404
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE}/api/trips/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/trips/invalid-uuid (404)" "404" "$CODE"

# ─── 5. Route Detail ──────────────────────────────────────────────────────────
section "Route Detail"

if [ -n "$TRIP_ID" ]; then
  ROUTE=$(curl -s "${BASE}/api/trips/$TRIP_ID/route" \
    -H "Authorization: Bearer $TOKEN")
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE}/api/trips/$TRIP_ID/route" \
    -H "Authorization: Bearer $TOKEN")
  check_status "GET /api/trips/:id/route" "200" "$CODE"
  check_contains "Route has trip" '"trip"' "$ROUTE"
  check_contains "Route has estimate" '"estimate"' "$ROUTE"
  check_contains "Route has breakdown" '"breakdown"' "$ROUTE"
  check_contains "Route has fuel_stops" '"fuel_stops"' "$ROUTE"
else
  skip "Route detail (no trip_id)"
fi

# ─── 6. CSV Upload ────────────────────────────────────────────────────────────
section "CSV Upload"

# Create a temp CSV
TMP_CSV=$(mktemp /tmp/test_XXXXXX.csv)
cat > "$TMP_CSV" << 'ENDCSV'
origin,destination,vehicle_id,distance_km
Mumbai,Pune,11111111-1111-1111-1111-111111111102,148
Delhi,Agra,11111111-1111-1111-1111-111111111105,205
ENDCSV

UPLOAD=$(curl -s -X POST "${BASE}/api/trips/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TMP_CSV")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/trips/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TMP_CSV")
check_status "POST /api/trips/upload (valid CSV)" "200" "$CODE"
check_contains "Upload has inserted field" '"inserted"' "$UPLOAD"
check_contains "Upload has skipped field" '"skipped"' "$UPLOAD"

INSERTED=$(echo "$UPLOAD" | grep -o '"inserted":[0-9]*' | cut -d: -f2)
if [ "${INSERTED:-0}" -gt 0 ]; then
  pass "Inserted $INSERTED trips from CSV"
else
  fail "Expected >0 inserted trips, got: $INSERTED"
fi

rm -f "$TMP_CSV"

# Missing column CSV
TMP_BAD=$(mktemp /tmp/test_bad_XXXXXX.csv)
echo "origin,destination" > "$TMP_BAD"
echo "Mumbai,Pune" >> "$TMP_BAD"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/trips/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TMP_BAD")
check_status "POST /api/trips/upload (missing columns)" "400" "$CODE"

rm -f "$TMP_BAD"

# No file
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/trips/upload" \
  -H "Authorization: Bearer $TOKEN")
check_status "POST /api/trips/upload (no file)" "400" "$CODE"

# ─── 7. Vehicles ──────────────────────────────────────────────────────────────
section "Vehicles"

VLIST=$(curl -s "${BASE}/api/vehicles" -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/vehicles" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/vehicles" "200" "$CODE"
check_contains "Has motorcycle" "motorcycle" "$VLIST"
check_contains "Has truck" "truck" "$VLIST"

# ─── 8. Analytics ─────────────────────────────────────────────────────────────
section "Analytics"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/analytics/summary" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/analytics/summary" "200" "$CODE"

SUMMARY=$(curl -s "${BASE}/api/analytics/summary" -H "Authorization: Bearer $TOKEN")
check_contains "Summary has total_trips" "total_trips" "$SUMMARY"
check_contains "Summary has total_toll_spend" "total_toll_spend" "$SUMMARY"
check_contains "Summary has avg_cost_per_trip" "avg_cost_per_trip" "$SUMMARY"
check_contains "Summary has flagged_routes" "flagged_routes" "$SUMMARY"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/analytics/spend" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/analytics/spend" "200" "$CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/analytics/corridors" \
  -H "Authorization: Bearer $TOKEN")
check_status "GET /api/analytics/corridors" "200" "$CODE"

CORRIDORS=$(curl -s "${BASE}/api/analytics/corridors" -H "Authorization: Bearer $TOKEN")
# Should have at most 5 entries
COUNT=$(echo "$CORRIDORS" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$COUNT" -le 5 ]; then
  pass "Corridors limited to max 5 (got $COUNT)"
else
  fail "Expected ≤5 corridors, got $COUNT"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  ${BOLD}Results: ${TOTAL} tests${RESET}"
echo -e "  ${GREEN}${PASS} passed${RESET}  ${RED}${FAIL} failed${RESET}  ${YELLOW}${SKIP} skipped${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}\n"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
