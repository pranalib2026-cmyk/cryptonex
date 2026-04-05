// ═══════════════════════════════════════════════════════════
// Analysis Engine — Master Orchestrator
// Runs all analysis modules and produces unified output
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const cache = require('../config/cache');
const { analyzeMarket } = require('./technicalAnalysis');
const { predictTrend } = require('./trendPrediction');
const { classifyMarket } = require('./marketClassifier');
const { computeSmartScore } = require('./smartScore');

const BINANCE_API = 'https://api.binance.com/api/v3';

/**
 * Run full analysis pipeline
 * @param {string} symbol   e.g. 'BTCUSDT'
 * @param {string} period   e.g. '90d'
 * @returns {Object}         Complete analysis result
 */
async function runAnalysis(symbol = 'BTCUSDT', period = '90d') {
    const cacheKey = `analysis:${symbol}:${period}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    console.log(`  ⚙ Running full analysis for ${symbol} (${period})...`);
    const startTime = Date.now();

    // ─── 1. Fetch OHLCV data from Binance ────────────
    const days = parseInt(period) || 90;
    const candles = await fetchBinanceCandles(symbol, '1d', days);

    if (!candles || candles.length < 14) {
        return {
            success: false,
            error: 'Failed to fetch sufficient price data from Binance',
            symbol,
            period,
            timestamp: Date.now(),
        };
    }

    // ─── 2. Run all analysis modules in parallel ─────
    const [technicalSignal, prediction, marketCondition] = await Promise.all([
        safeRun(() => analyzeMarket(candles)),
        safeRun(() => predictTrend(candles)),
        safeRun(() => classifyMarket(candles)),
    ]);

    // Smart score needs technical signal, so run sequentially
    const smartScore = await safeRun(() => computeSmartScore(technicalSignal));

    const elapsed = Date.now() - startTime;

    // ─── 3. Build unified response ───────────────────
    const result = {
        success: true,
        symbol,
        period: `${days}d`,
        dataPoints: candles.length,
        currentPrice: candles[candles.length - 1].close,
        analysisTime: `${elapsed}ms`,
        timestamp: Date.now(),

        // Module outputs
        technicalAnalysis: technicalSignal,
        prediction,
        marketCondition,
        smartScore,

        // Summary for dashboard
        summary: buildSummary(technicalSignal, prediction, marketCondition, smartScore),

        // Disclaimer
        disclaimer: 'This analysis is for educational and informational purposes only. Not financial advice. Past performance does not indicate future results.',
    };

    // Cache for 15 minutes (re-analysis runs every 4 hours via scheduler)
    await cache.set(cacheKey, result, 900);

    console.log(`  ✔ Analysis complete for ${symbol} in ${elapsed}ms`);
    return result;
}

/**
 * Fetch daily candles from Binance REST API
 */
async function fetchBinanceCandles(symbol, interval = '1d', days = 90) {
    try {
        const limit = Math.min(days, 1000);
        const res = await axios.get(`${BINANCE_API}/klines`, {
            params: {
                symbol: symbol.toUpperCase(),
                interval,
                limit,
            },
            timeout: 15000,
        });

        return res.data.map(k => ({
            timestamp: new Date(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: new Date(k[6]),
            quoteVolume: parseFloat(k[7]),
            trades: k[8],
        }));
    } catch (err) {
        console.error(`  ✘ Binance klines fetch error: ${err.message}`);
        return null;
    }
}

/**
 * Safe wrapper to catch individual module errors
 */
async function safeRun(fn) {
    try {
        const result = fn();
        // Handle both sync and async
        return result instanceof Promise ? await result : result;
    } catch (err) {
        console.error(`  ✘ Analysis module error: ${err.message}`);
        return { error: err.message };
    }
}

/**
 * Build a concise summary for the dashboard
 */
function buildSummary(tech, prediction, market, smart) {
    const lines = [];

    if (tech?.signal) {
        lines.push(`Signal: ${tech.signal} (${tech.confidence}% confidence)`);
    }
    if (market?.label) {
        lines.push(`Market Phase: ${market.label}`);
    }
    if (smart?.score !== undefined) {
        lines.push(`Smart Score: ${smart.score}/100 (${smart.label})`);
    }
    if (prediction?.trend?.direction) {
        lines.push(`Trend: ${prediction.trend.direction.replace(/_/g, ' ')} (R²=${prediction.trend.rSquared})`);
    }
    if (prediction?.predictions?.length > 0) {
        const day7 = prediction.predictions[prediction.predictions.length - 1];
        lines.push(`7-Day Forecast: $${day7.predicted?.toLocaleString()} (range: $${day7.lower?.toLocaleString()}–$${day7.upper?.toLocaleString()})`);
    }
    if (tech?.support) {
        lines.push(`Support: $${tech.support.toLocaleString()} | Resistance: $${tech.resistance.toLocaleString()}`);
    }

    return lines;
}

module.exports = { runAnalysis, fetchBinanceCandles };
