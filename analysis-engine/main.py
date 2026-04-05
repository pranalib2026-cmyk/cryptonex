# ═══════════════════════════════════════════════════════════
# CryptoNex — FastAPI Analysis Engine
# Statistical price analysis & prediction for BTC
# ═══════════════════════════════════════════════════════════

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import numpy as np
import pandas as pd
import httpx
import asyncio
import time
import json
from datetime import datetime, timedelta
from functools import lru_cache

app = FastAPI(
    title="CryptoNex Analysis Engine",
    version="1.0.0",
    description="Statistical Bitcoin price analysis and prediction",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Cache ────────────────────────────────────────────────
analysis_cache = {}
CACHE_TTL = 900  # 15 minutes


# ─── Models ───────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    symbol: str = Field(default="BTCUSDT", description="Trading pair symbol")
    period: str = Field(default="90d", description="Analysis period (7d-365d)")


class PredictionPoint(BaseModel):
    date: str
    day: int
    predicted: float
    upper: float
    lower: float


class TrendInfo(BaseModel):
    slope: float
    daily_return_pct: float
    direction: str
    r_squared: float
    strength: str


class TechnicalSignal(BaseModel):
    signal: str  # BULLISH | BEARISH | NEUTRAL
    confidence: int  # 0-100
    reasons: list[str]
    support: float
    resistance: float
    rsi: Optional[float] = None
    macd_histogram: Optional[float] = None


class MarketCondition(BaseModel):
    phase: str
    label: str
    explanation: str


class AnalysisResponse(BaseModel):
    success: bool = True
    symbol: str
    period: str
    current_price: float
    analysis_time_ms: int
    technical: TechnicalSignal
    predictions: list[PredictionPoint]
    trend: TrendInfo
    market_condition: MarketCondition
    smart_score: int
    smart_label: str
    disclaimer: str = "Statistical Trend Estimate — Not Financial Advice"


# ─── Data Fetching ────────────────────────────────────────
async def fetch_binance_candles(symbol: str, interval: str = "1d", limit: int = 90) -> pd.DataFrame:
    url = "https://api.binance.com/api/v3/klines"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params={"symbol": symbol.upper(), "interval": interval, "limit": limit})
        resp.raise_for_status()
        data = resp.json()

    df = pd.DataFrame(data, columns=[
        "timestamp", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_buy_base",
        "taker_buy_quote", "ignore"
    ])
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


async def fetch_fear_greed() -> int:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.alternative.me/fng/?limit=1")
            data = resp.json()
            return int(data["data"][0]["value"])
    except Exception:
        return 50  # neutral fallback


# ─── Technical Analysis ──────────────────────────────────
def compute_rsi(closes: np.ndarray, period: int = 14) -> float:
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def compute_ema(closes: np.ndarray, period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    s = pd.Series(closes)
    return round(float(s.ewm(span=period, adjust=False).mean().iloc[-1]), 2)


def compute_macd(closes: np.ndarray):
    s = pd.Series(closes)
    ema12 = s.ewm(span=12, adjust=False).mean()
    ema26 = s.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    return {
        "macd": round(float(macd_line.iloc[-1]), 2),
        "signal": round(float(signal_line.iloc[-1]), 2),
        "histogram": round(float(histogram.iloc[-1]), 2),
        "prev_histogram": round(float(histogram.iloc[-2]), 2) if len(histogram) > 1 else 0,
    }


def compute_bollinger(closes: np.ndarray, period: int = 20, std_dev: int = 2):
    s = pd.Series(closes)
    sma = s.rolling(period).mean()
    std = s.rolling(period).std()
    return {
        "upper": round(float(sma.iloc[-1] + std_dev * std.iloc[-1]), 2),
        "middle": round(float(sma.iloc[-1]), 2),
        "lower": round(float(sma.iloc[-1] - std_dev * std.iloc[-1]), 2),
    }


def run_technical_analysis(df: pd.DataFrame) -> TechnicalSignal:
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    price = closes[-1]

    rsi = compute_rsi(closes)
    macd = compute_macd(closes)
    ema50 = compute_ema(closes, 50)
    ema200 = compute_ema(closes, 200)

    bull, bear = 0, 0
    reasons = []

    # RSI
    if rsi < 30:
        bull += 12
        reasons.append(f"RSI oversold at {rsi} — bounce likely")
    elif rsi > 70:
        bear += 12
        reasons.append(f"RSI overbought at {rsi} — pullback risk")

    # MACD
    if macd["histogram"] > 0 and macd["prev_histogram"] <= 0:
        bull += 12
        reasons.append("MACD bullish crossover — momentum shifting up")
    elif macd["histogram"] < 0 and macd["prev_histogram"] >= 0:
        bear += 12
        reasons.append("MACD bearish crossover — momentum shifting down")
    elif macd["histogram"] > 0:
        bull += 5
        reasons.append(f"MACD positive ({macd['histogram']})")
    else:
        bear += 5
        reasons.append(f"MACD negative ({macd['histogram']})")

    # EMA crossover
    if ema50 and ema200:
        if ema50 > ema200 and price > ema50:
            bull += 15
            reasons.append("Golden cross — strong bull structure")
        elif ema50 < ema200 and price < ema50:
            bear += 15
            reasons.append("Death cross — strong bear structure")

    # Support/Resistance
    recent_lows = lows[-20:]
    recent_highs = highs[-20:]
    support = round(float(np.min(recent_lows)), 2)
    resistance = round(float(np.max(recent_highs)), 2)

    total = bull + bear
    net = ((bull - bear) / total * 100) if total > 0 else 0

    if net > 20:
        signal, confidence = "BULLISH", min(int(50 + net / 2), 95)
    elif net < -20:
        signal, confidence = "BEARISH", min(int(50 + abs(net) / 2), 95)
    else:
        signal, confidence = "NEUTRAL", int(50 - abs(net))

    return TechnicalSignal(
        signal=signal, confidence=confidence, reasons=reasons,
        support=support, resistance=resistance,
        rsi=rsi, macd_histogram=macd["histogram"],
    )


# ─── Trend Prediction ────────────────────────────────────
def predict_trend(df: pd.DataFrame) -> tuple[list[PredictionPoint], TrendInfo]:
    closes = df["close"].values[-30:]
    log_prices = np.log(closes)
    x = np.arange(len(log_prices))

    # Linear regression
    coeffs = np.polyfit(x, log_prices, 1)
    slope, intercept = coeffs

    # R-squared
    predicted_log = np.polyval(coeffs, x)
    ss_res = np.sum((log_prices - predicted_log) ** 2)
    ss_tot = np.sum((log_prices - np.mean(log_prices)) ** 2)
    r_squared = round(max(0, 1 - ss_res / ss_tot), 4) if ss_tot > 0 else 0

    # Holt-Winters
    alpha, beta = 0.3, 0.1
    level = closes[0]
    trend_val = closes[1] - closes[0] if len(closes) > 1 else 0

    for val in closes[1:]:
        prev_level = level
        level = alpha * val + (1 - alpha) * (prev_level + trend_val)
        trend_val = beta * (level - prev_level) + (1 - beta) * trend_val

    # Residuals for confidence bands
    residuals = closes - np.exp(np.polyval(coeffs, x))
    std_dev = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0

    # 7-day forecast
    last_date = df["timestamp"].iloc[-1]
    predictions = []
    for day in range(1, 8):
        future_date = last_date + timedelta(days=day)
        reg_pred = float(np.exp(intercept + slope * (len(log_prices) + day)))
        hw_pred = level + trend_val * day
        blended = reg_pred * 0.4 + hw_pred * 0.6
        band = std_dev * np.sqrt(day) * 1.2

        predictions.append(PredictionPoint(
            date=future_date.strftime("%Y-%m-%d"),
            day=day,
            predicted=round(blended, 2),
            upper=round(blended + band, 2),
            lower=round(max(blended - band, 0), 2),
        ))

    daily_ret = slope * 100
    if daily_ret > 0.3: direction = "strong_uptrend"
    elif daily_ret > 0.05: direction = "uptrend"
    elif daily_ret > -0.05: direction = "sideways"
    elif daily_ret > -0.3: direction = "downtrend"
    else: direction = "strong_downtrend"

    trend_info = TrendInfo(
        slope=round(slope, 6),
        daily_return_pct=round(daily_ret, 2),
        direction=direction,
        r_squared=r_squared,
        strength="strong" if r_squared > 0.7 else "moderate" if r_squared > 0.4 else "weak",
    )

    return predictions, trend_info


# ─── Market Classifier ───────────────────────────────────
def classify_market(df: pd.DataFrame) -> MarketCondition:
    closes = df["close"].values
    price = closes[-1]
    ema50 = compute_ema(closes, 50)
    ema200 = compute_ema(closes, min(200, len(closes) - 1))

    if ema50 and ema200 and price > ema200 and ema50 > ema200:
        return MarketCondition(phase="bull_market", label="🟢 Bull Market",
            explanation=f"Price ${price:,.0f} above EMA50 (${ema50:,.0f}) and EMA200 (${ema200:,.0f}). Golden cross confirmed.")
    elif ema50 and ema200 and price < ema200 and ema50 < ema200:
        return MarketCondition(phase="bear_market", label="🔴 Bear Market",
            explanation=f"Price ${price:,.0f} below EMA50 (${ema50:,.0f}) and EMA200 (${ema200:,.0f}). Death cross active.")
    else:
        return MarketCondition(phase="transition", label="⚪ Transition",
            explanation="Mixed signals — market structure is unclear. Wait for confirmation.")


# ─── Smart Score ──────────────────────────────────────────
def compute_smart_score(tech_confidence: int, tech_signal: str, fng: int, rsi: float) -> tuple[int, str]:
    tech_score = 50 + (tech_confidence / 2) if tech_signal == "BULLISH" else 50 - (tech_confidence / 2) if tech_signal == "BEARISH" else 50
    score = int(tech_score * 0.45 + fng * 0.30 + min(rsi, 100) * 0.25)
    score = max(0, min(100, score))

    if score >= 80: label = "Strong Bullish"
    elif score >= 65: label = "Bullish"
    elif score >= 55: label = "Slightly Bullish"
    elif score >= 45: label = "Neutral"
    elif score >= 35: label = "Slightly Bearish"
    elif score >= 20: label = "Bearish"
    else: label = "Strong Bearish"

    return score, label


# ─── Routes ───────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "analysis-engine", "timestamp": int(time.time())}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: AnalysisRequest):
    cache_key = f"{req.symbol}:{req.period}"
    if cache_key in analysis_cache:
        entry = analysis_cache[cache_key]
        if time.time() - entry["ts"] < CACHE_TTL:
            return entry["data"]

    start = time.time()
    days = int(req.period.replace("d", ""))
    days = max(7, min(days, 365))

    try:
        df = await fetch_binance_candles(req.symbol, "1d", days)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance API error: {str(e)}")

    fng = await fetch_fear_greed()
    technical = run_technical_analysis(df)
    predictions, trend = predict_trend(df)
    market = classify_market(df)
    smart_score, smart_label = compute_smart_score(
        technical.confidence, technical.signal, fng, technical.rsi or 50
    )

    elapsed = int((time.time() - start) * 1000)

    response = AnalysisResponse(
        symbol=req.symbol.upper(),
        period=f"{days}d",
        current_price=round(float(df["close"].iloc[-1]), 2),
        analysis_time_ms=elapsed,
        technical=technical,
        predictions=predictions,
        trend=trend,
        market_condition=market,
        smart_score=smart_score,
        smart_label=smart_label,
    )

    analysis_cache[cache_key] = {"data": response, "ts": time.time()}
    return response


@app.get("/analyze")
async def analyze_get():
    return await analyze(AnalysisRequest())
