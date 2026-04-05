# ═══════════════════════════════════════════════════════════
#  CryptoNex — Makefile
#  Convenience shortcuts for common Docker Compose commands
#  Usage: make <target>
# ═══════════════════════════════════════════════════════════

.PHONY: up down dev dev-down logs build rebuild ps health test clean prune

# ─── Production ─────────────────────────────────────────────
up:
	@echo "🚀 Starting CryptoNex (production)..."
	docker compose up -d
	@echo "✔  Access the dashboard at http://localhost"

down:
	docker compose down

# ─── Development ────────────────────────────────────────────
dev:
	@echo "🛠  Starting CryptoNex (development — hot-reload)..."
	docker compose -f docker-compose.dev.yml up -d
	@echo "✔  Dashboard:      http://localhost:3000"
	@echo "   Backend:        http://localhost:4000/api/health"
	@echo "   Analysis:       http://localhost:8000/health"
	@echo "   MongoDB Admin:  http://localhost:8081"
	@echo "   pgAdmin:        http://localhost:5050"
	@echo "   Redis Admin:    http://localhost:8082"

dev-down:
	docker compose -f docker-compose.dev.yml down

# ─── Logs ───────────────────────────────────────────────────
logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-analysis:
	docker compose logs -f analysis

# ─── Build ──────────────────────────────────────────────────
build:
	docker compose build

rebuild:
	docker compose up -d --build

rebuild-%:
	docker compose up -d --build $*

# ─── Status ─────────────────────────────────────────────────
ps:
	docker compose ps

health:
	@echo "─── Nginx ───────────────────────────────"
	@curl -sf http://localhost/health | python3 -m json.tool || echo "❌ Nginx unreachable"
	@echo "─── Backend ─────────────────────────────"
	@curl -sf http://localhost/api/health | python3 -m json.tool || echo "❌ Backend unreachable"
	@echo "─── Analysis Engine ─────────────────────"
	@curl -sf http://localhost/analysis/health | python3 -m json.tool || echo "❌ Analysis unreachable"

# ─── Testing ────────────────────────────────────────────────
test:
	@echo "─── Backend unit tests ──────────────────"
	cd server && node tests/analysis.test.js
	@echo "─── Analysis Engine smoke test ──────────"
	cd analysis-engine && python3 -c "import main; print('✔ Import OK')"

# ─── Database ───────────────────────────────────────────────
psql:
	docker compose exec postgres psql -U cryptonex -d cryptonex

mongo-shell:
	docker compose exec mongo mongosh cryptonex

redis-cli:
	docker compose exec redis redis-cli

# ─── Cleanup ────────────────────────────────────────────────
clean:
	docker compose down -v
	@echo "✔  All containers, volumes, and networks removed"

prune:
	docker system prune -f
	docker volume prune -f
	@echo "✔  Docker system pruned"
