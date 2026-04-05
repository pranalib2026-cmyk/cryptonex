// ═══════════════════════════════════════════════════════════
// Technical Analysis Module
// Input: 90-day OHLCV data
// Output: structured Market Signal object
// ═══════════════════════════════════════════════════════════

const ti = require('technicalindicators');

/**
 * @typedef {Object} MarketSignal
 * @property {'BULLISH'|'BEARISH'|'NEUTRAL'} signal
 * @property {number} confidence  0–100
 * @property {string[]} reasons
 * @property {number} support
 * @property {number} resistance
 * @property {number} stopLoss
 * @property {Object} indicators   raw indicator values
 */

/**
 * Run full technical analysis on OHLCV data
 * @param {Object[]} candles  [{open,high,low,close,volume,timestamp},...]
 * @returns {MarketSignal}
 */
function analyzeMarket(candles) {
    if (!candles || candles.length < 30) {
        return fallbackSignal('Insufficient data — need at least 30 candles');
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const price = closes[closes.length - 1];

    // ─── Compute indicators ──────────────────────────
    const rsi = computeRSI(closes, 14);
    const macd = computeMACD(closes);
    const bb = computeBollingerBands(closes, 20, 2);
    const ema50 = computeEMA(closes, 50);
    const ema200 = computeEMA(closes, 200);
    const ema20 = computeEMA(closes, 20);
    const volumeTrend = computeVolumeTrend(volumes);
    const atr = computeATR(highs, lows, closes, 14);
    const stochRSI = computeStochRSI(closes);
    const obv = computeOBV(closes, volumes);

    // ─── Rule-based signal scoring ───────────────────
    const rules = [];
    let bullPoints = 0;
    let bearPoints = 0;

    // 1. RSI rules
    if (rsi.value < 30) {
        if (ema200 && price > ema200) {
            bullPoints += 15;
            rules.push('RSI oversold (%.1f) with price above EMA200 → strong reversal setup'.replace('%.1f', rsi.value.toFixed(1)));
        } else {
            bullPoints += 8;
            rules.push(`RSI oversold at ${rsi.value.toFixed(1)} — potential bounce incoming`);
        }
    } else if (rsi.value > 70) {
        if (ema200 && price < ema200) {
            bearPoints += 15;
            rules.push(`RSI overbought (${rsi.value.toFixed(1)}) with price below EMA200 → rejection risk`);
        } else {
            bearPoints += 8;
            rules.push(`RSI overbought at ${rsi.value.toFixed(1)} — momentum may fade`);
        }
    } else if (rsi.value >= 50 && rsi.value <= 60) {
        bullPoints += 3;
        rules.push(`RSI neutral-bullish at ${rsi.value.toFixed(1)}`);
    } else if (rsi.value >= 40 && rsi.value < 50) {
        bearPoints += 3;
        rules.push(`RSI neutral-bearish at ${rsi.value.toFixed(1)}`);
    }

    // 2. MACD rules
    if (macd.histogram > 0 && macd.prevHistogram <= 0) {
        bullPoints += 12;
        rules.push('MACD bullish crossover detected — momentum shifting upward');
    } else if (macd.histogram < 0 && macd.prevHistogram >= 0) {
        bearPoints += 12;
        rules.push('MACD bearish crossover detected — momentum shifting downward');
    } else if (macd.histogram > 0) {
        bullPoints += 5;
        rules.push(`MACD positive (histogram: ${macd.histogram.toFixed(2)}) — uptrend intact`);
    } else if (macd.histogram < 0) {
        bearPoints += 5;
        rules.push(`MACD negative (histogram: ${macd.histogram.toFixed(2)}) — downtrend pressure`);
    }

    // 3. EMA crossover rules
    if (ema50 && ema200) {
        if (ema50 > ema200 && price > ema50) {
            bullPoints += 15;
            rules.push('Golden cross (EMA50 > EMA200) with price above both — strong bullish structure');
        } else if (ema50 < ema200 && price < ema50) {
            bearPoints += 15;
            rules.push('Death cross (EMA50 < EMA200) with price below both — bearish structure');
        } else if (ema50 > ema200 && price < ema50) {
            bullPoints += 5;
            rules.push('Golden cross intact but price pulling back below EMA50 — watch for support');
        } else if (ema50 < ema200 && price > ema50) {
            bearPoints += 5;
            rules.push('Death cross intact but price bouncing above EMA50 — potential recovery');
        }
    }

    // 4. Bollinger Band rules
    if (bb) {
        const bbWidth = ((bb.upper - bb.lower) / bb.middle) * 100;
        if (price <= bb.lower) {
            bullPoints += 10;
            rules.push(`Price touching lower Bollinger Band ($${bb.lower.toFixed(0)}) — oversold bounce likely`);
        } else if (price >= bb.upper) {
            bearPoints += 10;
            rules.push(`Price touching upper Bollinger Band ($${bb.upper.toFixed(0)}) — overbought resistance`);
        }
        if (bbWidth < 3) {
            rules.push(`Bollinger squeeze detected (bandwidth: ${bbWidth.toFixed(1)}%) — big move incoming`);
        }
    }

    // 5. Volume trend rules
    if (volumeTrend.trend === 'increasing' && price > closes[closes.length - 5]) {
        bullPoints += 8;
        rules.push('Rising volume confirming price uptrend — strong conviction');
    } else if (volumeTrend.trend === 'increasing' && price < closes[closes.length - 5]) {
        bearPoints += 8;
        rules.push('Rising volume on price decline — strong selling pressure');
    } else if (volumeTrend.trend === 'decreasing') {
        rules.push('Declining volume — trend may be weakening');
    }

    // 6. Stochastic RSI
    if (stochRSI !== null) {
        if (stochRSI < 20) {
            bullPoints += 5;
            rules.push(`Stochastic RSI extremely low (${stochRSI.toFixed(1)}) — reversal zone`);
        } else if (stochRSI > 80) {
            bearPoints += 5;
            rules.push(`Stochastic RSI extremely high (${stochRSI.toFixed(1)}) — exhaustion zone`);
        }
    }

    // ─── Support & Resistance ────────────────────────
    const { support, resistance } = computeSupportResistance(highs, lows, closes);

    // ─── Stop loss calculation ───────────────────────
    const stopLoss = atr
        ? round(price - 2 * atr)
        : round(support * 0.98);

    // ─── Final signal determination ──────────────────
    const totalPoints = bullPoints + bearPoints;
    const netScore = totalPoints > 0 ? ((bullPoints - bearPoints) / totalPoints) * 100 : 0;

    let signal, confidence;
    if (netScore > 20) {
        signal = 'BULLISH';
        confidence = Math.min(Math.round(50 + netScore / 2), 95);
    } else if (netScore < -20) {
        signal = 'BEARISH';
        confidence = Math.min(Math.round(50 + Math.abs(netScore) / 2), 95);
    } else {
        signal = 'NEUTRAL';
        confidence = Math.round(50 - Math.abs(netScore));
    }

    return {
        signal,
        confidence,
        reasons: rules,
        support: round(support),
        resistance: round(resistance),
        stopLoss: round(stopLoss),
        indicators: {
            rsi: rsi.value !== null ? round(rsi.value) : null,
            macd: {
                value: round(macd.MACD),
                signal: round(macd.signal),
                histogram: round(macd.histogram),
            },
            bollingerBands: bb ? {
                upper: round(bb.upper),
                middle: round(bb.middle),
                lower: round(bb.lower),
            } : null,
            ema: {
                ema20: round(ema20),
                ema50: round(ema50),
                ema200: round(ema200),
            },
            atr: round(atr),
            stochRSI: round(stochRSI),
            volumeTrend: volumeTrend,
            obv: {
                current: obv.current,
                trend: obv.trend,
            },
        },
        scoring: {
            bullPoints,
            bearPoints,
            netScore: round(netScore),
        },
    };
}

// ─── Individual Indicator Computations ──────────────

function computeRSI(closes, period) {
    try {
        const values = ti.RSI.calculate({ values: closes, period });
        return { value: values.length > 0 ? values[values.length - 1] : null };
    } catch { return { value: null }; }
}

function computeMACD(closes) {
    try {
        const values = ti.MACD.calculate({
            values: closes,
            fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
            SimpleMAOscillator: false, SimpleMASignal: false,
        });
        const cur = values[values.length - 1] || {};
        const prev = values[values.length - 2] || {};
        return {
            MACD: cur.MACD || 0,
            signal: cur.signal || 0,
            histogram: cur.histogram || 0,
            prevHistogram: prev.histogram || 0,
        };
    } catch { return { MACD: 0, signal: 0, histogram: 0, prevHistogram: 0 }; }
}

function computeBollingerBands(closes, period, stdDev) {
    try {
        const values = ti.BollingerBands.calculate({ period, values: closes, stdDev });
        return values.length > 0 ? values[values.length - 1] : null;
    } catch { return null; }
}

function computeEMA(closes, period) {
    try {
        if (closes.length < period) return null;
        const values = ti.EMA.calculate({ period, values: closes });
        return values.length > 0 ? values[values.length - 1] : null;
    } catch { return null; }
}

function computeATR(highs, lows, closes, period) {
    try {
        const values = ti.ATR.calculate({ high: highs, low: lows, close: closes, period });
        return values.length > 0 ? values[values.length - 1] : null;
    } catch { return null; }
}

function computeStochRSI(closes) {
    try {
        const values = ti.StochasticRSI.calculate({
            values: closes, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3,
        });
        const cur = values[values.length - 1];
        return cur ? cur.stochRSI : null;
    } catch { return null; }
}

function computeOBV(closes, volumes) {
    try {
        const values = ti.OBV.calculate({ close: closes, volume: volumes });
        if (values.length < 10) return { current: 0, trend: 'flat' };
        const recent = values.slice(-10);
        const half = Math.floor(recent.length / 2);
        const firstHalf = recent.slice(0, half).reduce((a, b) => a + b, 0) / half;
        const secondHalf = recent.slice(half).reduce((a, b) => a + b, 0) / (recent.length - half);
        const trend = secondHalf > firstHalf * 1.02 ? 'rising' : secondHalf < firstHalf * 0.98 ? 'falling' : 'flat';
        return { current: values[values.length - 1], trend };
    } catch { return { current: 0, trend: 'flat' }; }
}

function computeVolumeTrend(volumes) {
    if (volumes.length < 10) return { trend: 'unknown', ratio: 1 };
    const recent5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prev5 = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    const ratio = prev5 > 0 ? recent5 / prev5 : 1;
    let trend;
    if (ratio > 1.2) trend = 'increasing';
    else if (ratio < 0.8) trend = 'decreasing';
    else trend = 'stable';
    return { trend, ratio: round(ratio) };
}

function computeSupportResistance(highs, lows, closes) {
    // Use recent 20-day pivot points
    const recentLows = lows.slice(-20);
    const recentHighs = highs.slice(-20);
    const price = closes[closes.length - 1];

    // Support: lowest low in recent period
    const localLows = [];
    for (let i = 1; i < recentLows.length - 1; i++) {
        if (recentLows[i] < recentLows[i - 1] && recentLows[i] < recentLows[i + 1]) {
            localLows.push(recentLows[i]);
        }
    }
    const support = localLows.length > 0
        ? localLows.reduce((a, b) => Math.abs(a - price) < Math.abs(b - price) && a < price ? a : b, localLows[0])
        : Math.min(...recentLows);

    // Resistance: highest high in recent period
    const localHighs = [];
    for (let i = 1; i < recentHighs.length - 1; i++) {
        if (recentHighs[i] > recentHighs[i - 1] && recentHighs[i] > recentHighs[i + 1]) {
            localHighs.push(recentHighs[i]);
        }
    }
    const resistance = localHighs.length > 0
        ? localHighs.reduce((a, b) => Math.abs(a - price) < Math.abs(b - price) && a > price ? a : b, localHighs[0])
        : Math.max(...recentHighs);

    return { support, resistance };
}

function fallbackSignal(reason) {
    return {
        signal: 'NEUTRAL',
        confidence: 0,
        reasons: [reason],
        support: 0,
        resistance: 0,
        stopLoss: 0,
        indicators: {},
        scoring: { bullPoints: 0, bearPoints: 0, netScore: 0 },
    };
}

function round(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

module.exports = { analyzeMarket, computeRSI, computeMACD, computeBollingerBands, computeEMA, computeATR, computeVolumeTrend, computeSupportResistance };
