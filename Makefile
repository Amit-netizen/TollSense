.PHONY: up down build test test-backend test-frontend test-integration \
        seed logs clean help

# ─── Docker ──────────────────────────────────────────────────────────────────

up:
	docker compose up --build -d
	@echo "✅ TollSense running:"
	@echo "   Frontend  → http://localhost:3000"
	@echo "   Backend   → http://localhost:8080"
	@echo "   Login:      admin@tollsense.io / admin123"

down:
	docker compose down

clean:
	docker compose down -v --remove-orphans
	@echo "🗑  Volumes and containers removed"

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# ─── Local Dev ────────────────────────────────────────────────────────────────

dev-db:
	docker run -d --name tollsense_pg_dev \
	  -e POSTGRES_USER=tollsense \
	  -e POSTGRES_PASSWORD=tollsense123 \
	  -e POSTGRES_DB=tollsense_db \
	  -p 5432:5432 postgres:15-alpine || true
	@sleep 2
	docker exec -i tollsense_pg_dev psql -U tollsense -d tollsense_db \
	  < backend/migrations/init.sql || true
	@echo "✅ Local DB ready on :5432"

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && npm run dev

# ─── Tests ───────────────────────────────────────────────────────────────────

test: test-backend test-frontend
	@echo "✅ All unit tests passed"

test-backend:
	@echo "─── Go unit tests ───"
	cd backend && go test -v ./...

test-backend-coverage:
	cd backend && go test -coverprofile=coverage.out ./... && \
	  go tool cover -html=coverage.out -o coverage.html
	@echo "📊 Coverage report: backend/coverage.html"

test-frontend:
	@echo "─── Frontend unit tests ───"
	cd frontend && npm test

test-frontend-coverage:
	cd frontend && npm run test:coverage

test-integration:
	@echo "─── Integration tests (requires running backend) ───"
	bash test_integration.sh

test-load:
	@echo "─── k6 smoke test ───"
	k6 run k6-load-test.js

test-load-full:
	@echo "─── k6 load test (50 VUs) ───"
	k6 run -e SCENARIO=load k6-load-test.js

test-stress:
	@echo "─── k6 stress test (200 VUs) ───"
	k6 run -e SCENARIO=stress k6-load-test.js

# ─── Build ───────────────────────────────────────────────────────────────────

build-backend:
	cd backend && CGO_ENABLED=0 GOOS=linux go build -o tollsense ./cmd/server

build-frontend:
	cd frontend && npm run build

# ─── Seed / Reset ────────────────────────────────────────────────────────────

reseed:
	@echo "Re-seeding database..."
	docker compose exec postgres psql -U tollsense -d tollsense_db \
	  -c "TRUNCATE trips, toll_estimates, corridors RESTART IDENTITY CASCADE;"
	@echo "✅ Data cleared. Restart backend to re-seed via init.sql."

# ─── Help ────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "TollSense Makefile"
	@echo "══════════════════"
	@echo "  make up                 Start with Docker Compose"
	@echo "  make down               Stop containers"
	@echo "  make clean              Remove containers + volumes"
	@echo "  make logs               Tail all logs"
	@echo ""
	@echo "  make dev-db             Start Postgres for local dev"
	@echo "  make dev-backend        Run Go backend locally"
	@echo "  make dev-frontend       Run Next.js frontend locally"
	@echo ""
	@echo "  make test               Run all unit tests"
	@echo "  make test-backend       Go unit tests"
	@echo "  make test-frontend      Jest unit tests"
	@echo "  make test-integration   Integration tests (curl)"
	@echo "  make test-load          k6 smoke test"
	@echo "  make test-load-full     k6 load test (50 VUs, 10min)"
	@echo "  make test-stress        k6 stress test (200 VUs)"
	@echo ""
