-- ═══════════════════════════════════════════════════════════
-- CryptoNex — PostgreSQL Initialization Script
-- Tables: users, portfolio_holdings, price_snapshots, alerts
-- Run automatically on first container startup
-- ═══════════════════════════════════════════════════════════

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search on symbols

-- ─── Users ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT         NOT NULL UNIQUE,
    display_name  TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── Portfolio Holdings ──────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol        TEXT         NOT NULL,          -- e.g. BTCUSDT
    name          TEXT         NOT NULL,          -- e.g. Bitcoin
    quantity      NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
    avg_buy_price NUMERIC(20, 2) NOT NULL CHECK (avg_buy_price >= 0),
    notes         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON portfolio_holdings (user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON portfolio_holdings (symbol);

-- ─── Price Snapshots (time-series, archived from Redis) ──
CREATE TABLE IF NOT EXISTS price_snapshots (
    id            BIGSERIAL    PRIMARY KEY,
    symbol        TEXT         NOT NULL,
    price_usd     NUMERIC(20, 2) NOT NULL,
    price_inr     NUMERIC(20, 2),
    volume_24h    NUMERIC(30, 2),
    market_cap    NUMERIC(30, 2),
    change_24h    NUMERIC(10, 4),
    recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_time
    ON price_snapshots (symbol, recorded_at DESC);

-- Partition hint (manual partitioning — enable if data > 10M rows)
-- PARTITION BY RANGE (recorded_at);

-- ─── Price Alerts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol        TEXT         NOT NULL,
    condition     TEXT         NOT NULL CHECK (condition IN ('above', 'below')),
    target_price  NUMERIC(20, 2) NOT NULL,
    triggered     BOOLEAN      NOT NULL DEFAULT FALSE,
    triggered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user    ON price_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active  ON price_alerts (symbol, triggered)
    WHERE triggered = FALSE;

-- ─── Analysis Results (cache long-running analysis runs) ─
CREATE TABLE IF NOT EXISTS analysis_results (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol        TEXT         NOT NULL,
    period        TEXT         NOT NULL,
    smart_score   INTEGER      NOT NULL CHECK (smart_score BETWEEN 0 AND 100),
    signal        TEXT         NOT NULL,
    market_phase  TEXT         NOT NULL,
    payload       JSONB        NOT NULL,          -- full FastAPI response
    computed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_symbol_time
    ON analysis_results (symbol, computed_at DESC);

-- ─── Seed: demo anonymous user (optional) ─────────────────
INSERT INTO users (id, email, display_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@cryptonex.local',
    'Demo User'
) ON CONFLICT (email) DO NOTHING;

-- ─── Updated-at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trig_holdings_updated_at
    BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
