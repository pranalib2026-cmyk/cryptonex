# CryptoNex — Bitcoin Market Intelligence Platform

<div align="center">

![CryptoNex](https://img.shields.io/badge/CryptoNex-Bitcoin_Intelligence-8B5CF6?style=for-the-badge&logo=bitcoin&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)
![Nginx](https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=flat-square&logo=nginx)

**Real-time Bitcoin analytics, AI-powered market predictions, portfolio tracking — cyberpunk-themed dashboard.**

[Live Demo](#) · [API Docs](#-api-reference) · [Docker Setup](#-quick-start--5-min)

</div>

---

## 🏗️ Architecture

```
                         ┌──────────────────────────────────┐
                         │     Nginx  (Port 80 / 443)        │
                         │  / → frontend  /api → backend     │
                         │  /analysis → FastAPI  /ws → WS    │
                         └────┬────────────┬────────────┬───┘
                              │            │            │
                    ┌─────────▼──┐  ┌──────▼─────┐  ┌──▼─────────────┐
                    │  Frontend  │  │  Backend   │  │ Analysis Engine │
                    │  :3000     │  │  :4000     │  │  :8000          │
                    │  HTML/CSS  │  │ Express+WS │  │  FastAPI/numpy  │
                    └────────────┘  └──────┬─────┘  └───────┬─────────┘
                                           │                │
                              ┌────────────┼────────────────┤
                              │            │                │
                       ┌──────▼───┐  ┌─────▼────┐  ┌───────▼──┐
                       │ MongoDB  │  │PostgreSQL│  │  Redis   │
                       │  :27017  │  │  :5432   │  │  :6379   │
                       │ (docs,   │  │(portfolio│  │ (cache + │
                       │  news)   │  │ & users) │  │  pub/sub)│
                       └──────────┘  └──────────┘  └──────────┘
```

### Service Responsibilities

| Service | Technology | Purpose |
|---------|-----------|---------|
| **Nginx** | nginx:alpine | Reverse proxy, SSL termination, rate limiting, static asset caching |
| **Frontend** | HTML + CSS + JS | Cyberpunk dashboard — charts, portfolio, news feed |
| **Backend** | Node.js 20 + Express + WS | REST API, WebSocket relay, scheduler, rate limiting |
| **Analysis Engine** | Python 3.12 + FastAPI | Statistical analysis, RSI/MACD/BB, 7-day prediction |
| **MongoDB** | mongo:7 | Prices, news, analysis cache, whale alerts |
| **PostgreSQL** | postgres:16 | Portfolio holdings, users, price snapshots, alerts |
| **Redis** | redis:7 | API response cache, pub/sub for live price broadcast |

---

## ⚡ Quick Start (< 5 min)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) v20+
- [Git](https://git-scm.com/)

### Step 1 — Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/cryptonex.git
cd cryptonex
cp .env.example .env
# Optional: open .env and add API keys for richer data
```

### Step 2 — Launch All Services

```bash
# Production (7 services, optimized images)
docker compose up -d

# OR — Development (hot-reload + admin UIs)
docker compose -f docker-compose.dev.yml up -d
```

Docker will automatically:
1. Build all three application images
2. Start MongoDB, PostgreSQL, and Redis with health checks
3. Initialize the PostgreSQL schema (`postgres-init.sql`)
4. Initialize the MongoDB database (`mongo-init.js`)
5. Start the backend, analysis engine, and frontend
6. Start Nginx as the reverse proxy on port 80

### Step 3 — Access the Platform

| Service | URL | Notes |
|---------|-----|-------|
| 🖥️ **Dashboard** | http://localhost | Main cyberpunk UI |
| 🔌 **Backend API** | http://localhost/api/health | REST health check |
| 🧠 **Analysis Engine** | http://localhost/analysis/health | FastAPI health check |
| 📊 **MongoDB Admin** (dev) | http://localhost:8081 | Mongo Express |
| 🐘 **PostgreSQL Admin** (dev) | http://localhost:5050 | pgAdmin (admin@cryptonex.local / admin) |
| 🔴 **Redis Admin** (dev) | http://localhost:8082 | Redis Commander |

**Done.** BTC price streams from Binance WebSocket automatically on startup.

### Step 4 — Verify Everything Is Up

```bash
# Check all containers
docker compose ps

# Tail logs
docker compose logs -f

# Health check all three services
curl -s http://localhost/health         | python -m json.tool
curl -s http://localhost/api/health     | python -m json.tool
curl -s http://localhost/analysis/health | python -m json.tool
```

---

## 🚀 Running Without Docker

### Frontend
```bash
# Install a local static server and serve the root
npx -y http-server . -p 3000 --cors -c-1
# Open http://localhost:3000
```

### Backend (Node.js)
```bash
cd server
npm install
cp ../.env.example .env
# Edit .env: set MONGODB_URI, POSTGRES_URL, REDIS_URL to localhost equivalents
node server.js          # starts on :4000
# Dev with hot-reload:
node --watch server.js
```

### Analysis Engine (Python)
```bash
cd analysis-engine
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Database Services (local or Docker)
```bash
# Option A — Docker (easiest)
docker run -d -p 27017:27017 --name mongo    mongo:7
docker run -d -p 5432:5432  --name postgres \
  -e POSTGRES_DB=cryptonex -e POSTGRES_USER=cryptonex \
  -e POSTGRES_PASSWORD=cryptonex postgres:16-alpine
docker run -d -p 6379:6379  --name redis    redis:7-alpine

# Option B — Local
mongod --dbpath ./data/db
redis-server
# For PostgreSQL, use your system's service manager
```

---

## 📡 API Reference

### Backend API (port 4000 / via Nginx at `/api/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status, uptime, scheduler info, WS client count |
| `GET` | `/api/prices` | Live BTC price (USD + INR) |
| `GET` | `/api/prices/history?days=30` | Historical OHLCV data |
| `GET` | `/api/prices/candles?limit=100` | Real-time 1-min candles |
| `GET` | `/api/market-overview` | All markets (top 20 crypto + Nifty, Sensex) |
| `GET` | `/api/news?limit=10` | Crypto news with sentiment tags |
| `GET` | `/api/sentiment` | Fear & Greed Index + whale alerts |
| `GET` | `/api/indicators` | Technical indicators (RSI, MACD, Bollinger Bands) |
| `POST` | `/api/analyze` | Full AI analysis pipeline (via analysis engine) |
| `GET` | `/api/analyze/summary` | Quick dashboard summary |
| `GET` | `/api/portfolio` | Get all holdings |
| `POST` | `/api/portfolio` | Add holding |
| `PUT` | `/api/portfolio/:id` | Update holding |
| `DELETE` | `/api/portfolio/:id` | Remove holding |
| `WS` | `/ws` | Live price stream (Binance relay) |

### Analysis Engine (port 8000 / via Nginx at `/analysis/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Engine status |
| `POST` | `/analyze` | Full statistical analysis |
| `GET` | `/analyze` | Quick analysis (BTCUSDT, 90d defaults) |

### POST `/api/analyze` — Request

```json
{
  "symbol": "BTCUSDT",
  "period": "90d"
}
```

### POST `/api/analyze` — Response

```json
{
  "success": true,
  "symbol": "BTCUSDT",
  "period": "90d",
  "currentPrice": 84123.45,
  "analysisTime": "1247ms",
  "technicalAnalysis": {
    "signal": "BULLISH",
    "confidence": 73,
    "reasons": ["Golden cross — strong bull structure", "MACD positive"],
    "support": 81200.00,
    "resistance": 87500.00,
    "rsi": 58.4,
    "macdHistogram": 124.3
  },
  "predictions": [
    { "date": "2026-04-06", "day": 1, "predicted": 84800.00, "upper": 87200.00, "lower": 82400.00 }
  ],
  "trend": {
    "direction": "uptrend",
    "dailyReturnPct": 0.18,
    "rSquared": 0.62,
    "strength": "moderate"
  },
  "marketCondition": { "phase": "bull_market", "label": "🟢 Bull Market" },
  "smartScore": { "score": 71, "label": "Bullish" },
  "disclaimer": "Statistical Trend Estimate — Not Financial Advice"
}
```

### WebSocket `/ws`

Connect and receive real-time price ticks:

```javascript
const ws = new WebSocket('ws://localhost/ws');
ws.onmessage = (event) => {
  const { type, price, change24h, volume } = JSON.parse(event.data);
  // type: "price_update" | "candle" | "heartbeat"
};
```

---

## 🏛️ Project Structure

```
cryptonex/
├── index.html                        # Dashboard UI entry point
├── styles.css                        # Cyberpunk design system
├── app.js                            # Frontend logic (WebSocket, charts, state)
├── bg-video.mp4                      # Animated background
│
├── server/                           # Node.js backend
│   ├── server.js                     # Express + WS entry point
│   ├── config/
│   │   └── database.js               # MongoDB + Redis connection
│   ├── models/                       # Mongoose schemas
│   ├── routes/
│   │   ├── prices.js                 # /api/prices
│   │   ├── market.js                 # /api/market-overview
│   │   ├── news.js                   # /api/news
│   │   ├── sentiment.js              # /api/sentiment (Fear & Greed)
│   │   ├── indicators.js             # /api/indicators (TA)
│   │   ├── portfolio.js              # /api/portfolio (CRUD)
│   │   └── analyze.js                # /api/analyze (orchestrator)
│   ├── services/
│   │   ├── binanceWs.js              # Binance WebSocket client
│   │   ├── technicalAnalysis.js      # RSI, MACD, Bollinger Bands
│   │   ├── trendPrediction.js        # Linear regression + Holt-Winters
│   │   ├── marketClassifier.js       # Bull/Bear/Accumulation classifier
│   │   ├── smartScore.js             # Composite sentiment aggregator
│   │   └── analysisEngine.js         # Master orchestrator
│   ├── websocket/
│   │   └── wsHandler.js              # WS server + broadcast
│   ├── scheduler/
│   │   └── analysisScheduler.js      # 4-hour cron job
│   ├── middleware/
│   │   ├── rateLimiter.js            # express-rate-limit
│   │   └── errorHandler.js           # Centralized error middleware
│   ├── tests/
│   │   └── analysis.test.js          # 63 unit tests
│   └── package.json
│
├── analysis-engine/                   # Python FastAPI
│   ├── main.py                        # All analysis endpoints
│   └── requirements.txt
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.frontend        # nginx:alpine serving static files
│   │   ├── Dockerfile.backend         # Node.js multi-stage (dev + prod)
│   │   └── Dockerfile.analysis        # Python 3.12-slim
│   ├── nginx/
│   │   ├── nginx.conf                 # Reverse proxy, rate limits, WS, SSL stub
│   │   └── ssl/                       # Mount your certs here (fullchain.pem, privkey.pem)
│   └── db/
│       ├── mongo-init.js              # MongoDB collection + index setup
│       └── postgres-init.sql          # PostgreSQL schema (tables, indexes, triggers)
│
├── postman/                           # Postman collection for manual testing
├── docker-compose.yml                 # Production (7 services)
├── docker-compose.dev.yml             # Development (hot-reload + 3 admin UIs)
├── .github/workflows/ci-cd.yml        # CI/CD: lint → test → build → deploy
├── .env.example                       # Environment template — copy to .env
└── .gitignore
```

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| HTTP Security Headers | Nginx (X-Frame-Options, X-Content-Type-Options, XSS-Protection, Referrer-Policy) |
| Rate Limiting (Nginx) | `/api` → 100 req/min · `/analysis` → 20 req/min per IP |
| Rate Limiting (App) | `express-rate-limit` — 100 req/min per IP (double layer) |
| Input Sanitization | All portfolio fields validated with type checks and range guards |
| API Keys | Server-side only (`.env` / Docker secrets) — never exposed to frontend |
| Non-root Containers | Backend runs as `cryptonex` user (uid 1001), analysis as `analyst` |
| CORS | Configurable `FRONTEND_URL` — not wildcard in production |
| SQL Injection Prevention | Parameterized queries only (no raw string interpolation) |
| No `server_tokens` | Nginx version hidden from HTTP headers |

---

## 📊 Data Sources

| Source | Data | Auth Required |
|--------|------|---------------|
| **Binance WebSocket** | Real-time OHLCV + trade stream | ❌ Free, no key |
| **CoinGecko** | Market cap, history, top coins | ❌ Free (key increases limits) |
| **Alternative.me** | Fear & Greed Index | ❌ Free, no key |
| **Frankfurter** | USD/INR live exchange rate | ❌ Free, no key |
| **Yahoo Finance** | Nifty 50, Sensex | ❌ Free, no key |
| **CryptoPanic** | News feed + sentiment | 🔑 Free key required |
| **Whale Alert** | Large BTC transaction alerts | 🔑 Free key (100 req/day) |

> The platform works fully without any API keys — CryptoPanic news and Whale Alert data degrade gracefully to cached/placeholder data.

---

## 🧪 Testing

```bash
# ── Backend unit tests (Node.js) ──
cd server && node tests/analysis.test.js

# ── Analysis engine (Python) ──
cd analysis-engine && python -m pytest -v || python -c "import main; print('Import OK')"

# ── Docker health checks (end-to-end) ──
docker compose up -d
sleep 20
curl -sf http://localhost/health          && echo "✔ Nginx"
curl -sf http://localhost/api/health      && echo "✔ Backend"
curl -sf http://localhost/analysis/health && echo "✔ Analysis Engine"

# ── Live WebSocket test ──
# Install: npm install -g wscat
wscat -c ws://localhost/ws
```

---

## 📦 Deployment

### Option A — VPS (Ubuntu / Debian)

```bash
# 1. Install Docker on the VPS
sudo apt update && sudo apt install -y docker.io docker-compose-plugin

# 2. Clone the repo
sudo git clone https://github.com/YOUR_USERNAME/cryptonex.git /opt/cryptonex
cd /opt/cryptonex

# 3. Configure environment
cp .env.example .env
nano .env    # Set POSTGRES_PASSWORD and any API keys

# 4. Launch
docker compose up -d

# 5. Verify
docker compose ps
curl http://localhost/api/health
```

### Option B — GitHub Actions Auto-Deploy

Set these **Repository Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your server IP or domain |
| `VPS_USER` | SSH username (e.g., `ubuntu`) |
| `VPS_SSH_KEY` | Contents of your private SSH key |

Push to `main` → pipeline runs automatically:
1. Backend lints + tests
2. Python lints + FastAPI smoke test
3. Docker Compose config validation
4. Multi-tag image builds pushed to GHCR
5. SSH deploy + health verification

### Option C — Railway / Render

1. Fork this repo
2. Connect to [Railway](https://railway.app) or [Render](https://render.com)
3. Set environment variables from `.env.example`
4. Railway/Render auto-detects Dockerfiles and deploys each service

### SSL / HTTPS

1. Place your certificate files in `infrastructure/nginx/ssl/`:
   - `fullchain.pem`
   - `privkey.pem`
2. Uncomment the HTTPS server block in `infrastructure/nginx/nginx.conf`
3. Restart Nginx: `docker compose restart nginx`

> For free SSL, use [Let's Encrypt + Certbot](https://certbot.eff.org/) on your VPS, then copy certs into the ssl/ directory.

---

## 🛠️ Useful Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View live logs for a service
docker compose logs -f backend
docker compose logs -f analysis

# Rebuild a single service after code change
docker compose up -d --build backend

# Connect to PostgreSQL
docker compose exec postgres psql -U cryptonex -d cryptonex

# Connect to MongoDB shell
docker compose exec mongo mongosh cryptonex

# Redis CLI
docker compose exec redis redis-cli

# Scale analysis workers (if needed)
docker compose up -d --scale analysis=2
```

---

## 🔧 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `4000` | Backend server port |
| `MONGODB_URI` | `mongodb://mongo:27017/cryptonex` | MongoDB connection string |
| `POSTGRES_DB` | `cryptonex` | PostgreSQL database name |
| `POSTGRES_USER` | `cryptonex` | PostgreSQL username |
| `POSTGRES_PASSWORD` | — | Set in `.env` — see `.env.example` for the value |
| `POSTGRES_URL` | — | Full PG connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `FRONTEND_URL` | `http://frontend:3000` | CORS allowed origin |
| `ANALYSIS_ENGINE_URL` | `http://analysis:8000` | Internal FastAPI URL |
| `NGINX_PORT` | `80` | HTTP port |
| `NGINX_SSL_PORT` | `443` | HTTPS port |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `COINGECKO_API_KEY` | — | Optional — increases rate limits |
| `CRYPTOPANIC_API_KEY` | — | Required for news feed |
| `WHALE_ALERT_API_KEY` | — | Required for whale alerts |
| `ALPHA_VANTAGE_API_KEY` | — | Required for Nifty/Sensex |

---

## 📄 License

MIT © 2026 CryptoNex

---

<div align="center">
  <sub>Built with ⚡ by CryptoNex — <strong>Not Financial Advice</strong></sub>
</div>
