// ═══════════════════════════════════════════════════════════
// Service — Technical Indicator Engine
// Uses technicalindicators npm package
// Computes: RSI, MACD, Bollinger Bands, EMA, VWAP, ATR
// ═══════════════════════════════════════════════════════════

const ti = require('technicalindicators');
const cache = require('../config/cache');
const binanceWs = require('./binanceWs');
const PriceSnapshot = require('../models/PriceSnapshot');
const { isDatabaseConnected } = require('../config/database');

const TTL = parseInt(process.env.CACHE_TTL_INDICATORS) || 10;

/**
 * Compute all technical indicators for BTCUSDT
 */
async function computeIndicators() {
    const cacheKey = 'indicators:btcusdt';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Get candle data — prefer in-memory, fallback to DB
    let candles = binanceWs.getRecentCandles(300);

    if (candles.length < 50 && isDatabaseConnected()) {
        try {
            const dbCandles = await PriceSnapshot.getCandles('BTCUSDT', 300);
            if (dbCandles.length > candles.length) {
                candles = dbCandles;
            }
        } catch (e) { /* use what we have */ }
    }

    if (candles.length < 14) {
        // Not enough data for indicators — return placeholder
        return getPlaceholderIndicators();
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const result = {
        symbol: 'BTCUSDT',
        candles_used: candles.length,
        timestamp: Date.now(),

        // RSI (14-period)
        rsi: computeRSI(closes),

        // MACD (12, 26, 9)
        macd: computeMACD(closes),

        // Bollinger Bands (20-period, 2 std dev)
        bollingerBands: computeBollingerBands(closes),

        // EMA 50 and EMA 200
        ema: computeEMA(closes),

        // VWAP
        vwap: computeVWAP(closes, highs, lows, volumes),

        // ATR (14-period)
        atr: computeATR(highs, lows, closes),

        // Current price
        currentPrice: closes[closes.length - 1],

        // Signal summary
        signal: generateSignalSummary(closes, highs, lows, volumes),
    };

    await cache.set(cacheKey, result, TTL);
    return result;
}

function computeRSI(closes) {
    try {
        const values = ti.RSI.calculate({
            values: closes,
            period: 14,
        });

        const current = values[values.length - 1];
        return {
            value: round(current),
            period: 14,
            signal: current > 70 ? 'overbought' : current < 30 ? 'oversold' : 'neutral',
            history: values.slice(-20).map(v => round(v)),
        };
    } catch (e) {
        return { value: 62.4, period: 14, signal: 'neutral', history: [], _fallback: true };
    }
}

function computeMACD(closes) {
    try {
        const values = ti.MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });

        const current = values[values.length - 1];
        const prev = values[values.length - 2];

        let signal = 'neutral';
        if (current && prev) {
            if (current.histogram > 0 && prev.histogram <= 0) signal = 'bullish_cross';
            else if (current.histogram < 0 && prev.histogram >= 0) signal = 'bearish_cross';
            else if (current.histogram > 0) signal = 'bullish';
            else signal = 'bearish';
        }

        return {
            MACD: round(current?.MACD),
            signal_line: round(current?.signal),
            histogram: round(current?.histogram),
            config: { fast: 12, slow: 26, signal: 9 },
            signal,
            history: values.slice(-20).map(v => ({
                MACD: round(v?.MACD),
                signal: round(v?.signal),
                histogram: round(v?.histogram),
            })),
        };
    } catch (e) {
        return { MACD: 245.3, signal_line: 198.7, histogram: 46.6, signal: 'bullish', _fallback: true };
    }
}

function computeBollingerBands(closes) {
    try {
        const values = ti.BollingerBands.calculate({
            period: 20,
            values: closes,
            stdDev: 2,
        });

        const current = values[values.length - 1];
        const price = closes[closes.length - 1];

        let position = 'middle';
        if (current) {
            const range = current.upper - current.lower;
            const relPos = (price - current.lower) / range;
            if (relPos > 0.8) position = 'upper';
            else if (relPos < 0.2) position = 'lower';
        }

        return {
            upper: round(current?.upper),
            middle: round(current?.middle),
            lower: round(current?.lower),
            bandwidth: round(current ? (current.upper - current.lower) / current.middle * 100 : 0),
            position,
            config: { period: 20, stdDev: 2 },
        };
    } catch (e) {
        return { upper: 70200, middle: 68500, lower: 66800, position: 'middle', _fallback: true };
    }
}

function computeEMA(closes) {
    try {
        const ema50Values = ti.EMA.calculate({ period: 50, values: closes });
        const ema200Values = ti.EMA.calculate({ period: 200, values: closes });

        const ema50 = ema50Values[ema50Values.length - 1];
        const ema200 = ema200Values.length > 0 ? ema200Values[ema200Values.length - 1] : null;
        const price = closes[closes.length - 1];

        let trend = 'neutral';
        if (ema50 && ema200) {
            trend = ema50 > ema200 ? 'bullish' : 'bearish';
        }

        return {
            ema50: round(ema50),
            ema200: round(ema200),
            trend,
            price_vs_ema50: ema50 ? (price > ema50 ? 'above' : 'below') : null,
            golden_cross: ema50 && ema200 ? ema50 > ema200 : null,
        };
    } catch (e) {
        return { ema50: 67800, ema200: 65200, trend: 'bullish', _fallback: true };
    }
}

function computeVWAP(closes, highs, lows, volumes) {
    try {
        const values = ti.VWAP.calculate({
            high: highs,
            low: lows,
            close: closes,
            volume: volumes,
        });

        const current = values[values.length - 1];
        const price = closes[closes.length - 1];

        return {
            value: round(current),
            price_vs_vwap: current ? (price > current ? 'above' : 'below') : null,
            signal: current ? (price > current ? 'bullish' : 'bearish') : 'neutral',
        };
    } catch (e) {
        return { value: 68100, signal: 'bullish', _fallback: true };
    }
}

function computeATR(highs, lows, closes) {
    try {
        const values = ti.ATR.calculate({
            high: highs,
            low: lows,
            close: closes,
            period: 14,
        });

        const current = values[values.length - 1];
        const price = closes[closes.length - 1];

        return {
            value: round(current),
            period: 14,
            pct_of_price: round(current / price * 100),
            volatility: current / price > 0.03 ? 'high' : current / price > 0.015 ? 'moderate' : 'low',
        };
    } catch (e) {
        return { value: 850, period: 14, volatility: 'moderate', _fallback: true };
    }
}

function generateSignalSummary(closes, highs, lows, volumes) {
    const rsi = computeRSI(closes);
    const macd = computeMACD(closes);
    const ema = computeEMA(closes);
    const vwap = computeVWAP(closes, highs, lows, volumes);

    let bullishSignals = 0;
    let bearishSignals = 0;

    if (rsi.value < 30) bullishSignals++;
    if (rsi.value > 70) bearishSignals++;
    if (macd.signal?.includes('bullish')) bullishSignals++;
    if (macd.signal?.includes('bearish')) bearishSignals++;
    if (ema.trend === 'bullish') bullishSignals++;
    if (ema.trend === 'bearish') bearishSignals++;
    if (vwap.signal === 'bullish') bullishSignals++;
    if (vwap.signal === 'bearish') bearishSignals++;

    let overall = 'neutral';
    if (bullishSignals > bearishSignals + 1) overall = 'bullish';
    else if (bearishSignals > bullishSignals + 1) overall = 'bearish';

    return {
        overall,
        bullish_signals: bullishSignals,
        bearish_signals: bearishSignals,
        total_signals: bullishSignals + bearishSignals,
    };
}

function getPlaceholderIndicators() {
    return {
        symbol: 'BTCUSDT',
        candles_used: 0,
        timestamp: Date.now(),
        _fallback: true,
        rsi: { value: 62.4, period: 14, signal: 'neutral' },
        macd: { MACD: 245.3, signal_line: 198.7, histogram: 46.6, signal: 'bullish' },
        bollingerBands: { upper: 70200, middle: 68500, lower: 66800, position: 'middle' },
        ema: { ema50: 67800, ema200: 65200, trend: 'bullish' },
        vwap: { value: 68100, signal: 'bullish' },
        atr: { value: 850, period: 14, volatility: 'moderate' },
        currentPrice: 68432,
        signal: { overall: 'bullish', bullish_signals: 3, bearish_signals: 1, total_signals: 4 },
    };
}

function round(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

module.exports = { computeIndicators };
