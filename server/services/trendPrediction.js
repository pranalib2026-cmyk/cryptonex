// ═══════════════════════════════════════════════════════════
// Trend Prediction Module
// Linear regression on log price + Holt-Winters exponential
// smoothing for 7-day forecast with confidence bounds
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {Object} PredictionPoint
 * @property {string} date        YYYY-MM-DD
 * @property {number} predicted   predicted close price
 * @property {number} upper       upper bound (+1 std dev)
 * @property {number} lower       lower bound (-1 std dev)
 */

/**
 * Generate 7-day price prediction using statistical methods
 * @param {Object[]} candles  Daily OHLCV data (last 30-90 days)
 * @returns {{ predictions: PredictionPoint[], trend: Object, method: string }}
 */
function predictTrend(candles) {
    if (!candles || candles.length < 14) {
        return {
            predictions: [],
            trend: { slope: 0, direction: 'insufficient_data' },
            method: 'none',
            disclaimer: 'Statistical Trend Estimate — Not Financial Advice',
        };
    }

    const closes = candles.map(c => c.close);
    const timestamps = candles.map(c =>
        c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)
    );

    // ─── 1. Linear Regression on log prices (30-day window) ───
    const window = Math.min(closes.length, 30);
    const recentCloses = closes.slice(-window);
    const logPrices = recentCloses.map(p => Math.log(p));
    const linReg = linearRegression(logPrices);

    // ─── 2. Holt-Winters Double Exponential Smoothing ─────────
    const hwResult = holtWinters(recentCloses, 0.3, 0.1);

    // ─── 3. Standard deviation for confidence bands ───────────
    const residuals = recentCloses.map((p, i) => {
        const regPred = Math.exp(linReg.intercept + linReg.slope * (i + 1));
        return p - regPred;
    });
    const stdDev = standardDeviation(residuals);

    // ─── 4. Generate 7-day forecast ──────────────────────────
    const lastDate = timestamps[timestamps.length - 1];
    const lastPrice = closes[closes.length - 1];
    const predictions = [];

    for (let day = 1; day <= 7; day++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(futureDate.getDate() + day);

        // Linear regression projection
        const regIndex = window + day;
        const regPred = Math.exp(linReg.intercept + linReg.slope * regIndex);

        // Holt-Winters projection
        const hwPred = hwResult.level + hwResult.trend * day;

        // Weighted blend: 40% regression, 60% Holt-Winters
        const blended = regPred * 0.4 + hwPred * 0.6;

        // Confidence bands widen with time
        const bandWidth = stdDev * Math.sqrt(day) * 1.2;

        predictions.push({
            date: futureDate.toISOString().split('T')[0],
            day,
            predicted: round(blended),
            upper: round(blended + bandWidth),
            lower: round(Math.max(blended - bandWidth, 0)),
            regression: round(regPred),
            holtWinters: round(hwPred),
        });
    }

    // ─── 5. Trend analysis ───────────────────────────────────
    const dailyReturn = linReg.slope * 100; // log return per day
    const annualizedReturn = dailyReturn * 365;

    let direction;
    if (dailyReturn > 0.3) direction = 'strong_uptrend';
    else if (dailyReturn > 0.05) direction = 'uptrend';
    else if (dailyReturn > -0.05) direction = 'sideways';
    else if (dailyReturn > -0.3) direction = 'downtrend';
    else direction = 'strong_downtrend';

    // ─── 6. Trend strength via R² ────────────────────────────
    const rSquared = computeRSquared(logPrices, linReg);

    return {
        predictions,
        trend: {
            slope: round(linReg.slope * 10000) / 10000,
            dailyReturnPct: round(dailyReturn),
            annualizedReturnPct: round(annualizedReturn),
            direction,
            rSquared: round(rSquared),
            strength: rSquared > 0.7 ? 'strong' : rSquared > 0.4 ? 'moderate' : 'weak',
        },
        smoothing: {
            level: round(hwResult.level),
            trend: round(hwResult.trend),
            alpha: 0.3,
            beta: 0.1,
        },
        standardDeviation: round(stdDev),
        method: 'linear_regression + holt_winters_double_exponential',
        disclaimer: 'Statistical Trend Estimate — Not Financial Advice',
    };
}

// ─── Linear Regression (OLS) ────────────────────────────

function linearRegression(values) {
    const n = values.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        const x = i + 1;
        sumX += x;
        sumY += values[i];
        sumXY += x * values[i];
        sumX2 += x * x;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: values[0] || 0 };

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// ─── Holt-Winters Double Exponential Smoothing ──────────

function holtWinters(values, alpha = 0.3, beta = 0.1) {
    if (values.length < 2) {
        return { level: values[0] || 0, trend: 0, fitted: values };
    }

    let level = values[0];
    let trend = values[1] - values[0];
    const fitted = [level];

    for (let i = 1; i < values.length; i++) {
        const prevLevel = level;
        const prevTrend = trend;

        // Level update
        level = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);

        // Trend update
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;

        fitted.push(level + trend);
    }

    return { level, trend, fitted };
}

// ─── Statistical Helpers ────────────────────────────────

function standardDeviation(values) {
    const n = values.length;
    if (n < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
    return Math.sqrt(variance);
}

function computeRSquared(values, linReg) {
    const n = values.length;
    if (n === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    let ssTot = 0, ssRes = 0;

    for (let i = 0; i < n; i++) {
        const predicted = linReg.intercept + linReg.slope * (i + 1);
        ssTot += (values[i] - mean) ** 2;
        ssRes += (values[i] - predicted) ** 2;
    }

    return ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
}

function round(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

module.exports = {
    predictTrend,
    linearRegression,
    holtWinters,
    standardDeviation,
    computeRSquared,
};
