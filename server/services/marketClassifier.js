// ═══════════════════════════════════════════════════════════
// Market Condition Classifier
// Classifies: Bull, Bear, Accumulation, Distribution
// ═══════════════════════════════════════════════════════════

const ti = require('technicalindicators');

/**
 * @typedef {Object} MarketCondition
 * @property {string} phase        'bull_market' | 'bear_market' | 'accumulation' | 'distribution' | 'transition'
 * @property {string} label        Human-readable label
 * @property {string} explanation  Detailed explanation for dashboard display
 * @property {string} icon         Emoji for UI
 * @property {Object} criteria     Which rules matched
 */

/**
 * Classify current market conditions
 * @param {Object[]} candles  Daily OHLCV data
 * @returns {MarketCondition}
 */
function classifyMarket(candles) {
    if (!candles || candles.length < 50) {
        return {
            phase: 'unknown',
            label: 'Insufficient Data',
            explanation: 'Need at least 50 days of data to classify market conditions.',
            icon: '❓',
            criteria: {},
        };
    }

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const price = closes[closes.length - 1];

    // ─── Compute requirements ────────────────────────
    const ema50 = computeEMA(closes, 50);
    const ema200 = closes.length >= 200 ? computeEMA(closes, 200) : computeEMA(closes, closes.length - 1);
    const rsi = computeRSI(closes);

    // Price action analysis (20-day)
    const recent20 = closes.slice(-20);
    const priceRange = (Math.max(...recent20) - Math.min(...recent20)) / price * 100;
    const isSideways = priceRange < 8; // < 8% range = sideways

    // Volume analysis
    const avgVolRecent = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const avgVolPrev = volumes.slice(-30, -10).reduce((a, b) => a + b, 0) / 20;
    const volumeRatio = avgVolPrev > 0 ? avgVolRecent / avgVolPrev : 1;
    const isLowVolume = volumeRatio < 0.8;
    const isHighVolume = volumeRatio > 1.3;

    // Trend direction
    const priceAboveEMA200 = ema200 ? price > ema200 : null;
    const goldenCross = ema50 && ema200 ? ema50 > ema200 : null;

    // ─── Classification rules ────────────────────────

    const criteria = {
        priceAboveEMA200,
        goldenCross,
        rsi: rsi,
        isSideways,
        isLowVolume,
        isHighVolume,
        priceRange: round(priceRange),
        volumeRatio: round(volumeRatio),
    };

    // 1. BULL MARKET: price > EMA200 AND EMA50 > EMA200
    if (priceAboveEMA200 && goldenCross) {
        return {
            phase: 'bull_market',
            label: '🟢 Bull Market',
            explanation: buildBullExplanation(price, ema50, ema200, rsi),
            icon: '🐂',
            criteria,
            characteristics: [
                'Price trading above both EMA50 and EMA200',
                'Golden cross confirmed (EMA50 > EMA200)',
                'Higher highs and higher lows expected',
                'Dips are typically buying opportunities',
            ],
            strategy: 'Trend-following: buy dips near EMA50, target new highs. Trail stop below EMA50.',
        };
    }

    // 2. BEAR MARKET: price < EMA200 AND EMA50 < EMA200
    if (!priceAboveEMA200 && goldenCross === false) {
        return {
            phase: 'bear_market',
            label: '🔴 Bear Market',
            explanation: buildBearExplanation(price, ema50, ema200, rsi),
            icon: '🐻',
            criteria,
            characteristics: [
                'Price trading below both EMA50 and EMA200',
                'Death cross confirmed (EMA50 < EMA200)',
                'Lower highs and lower lows expected',
                'Rallies are typically selling/shorting opportunities',
            ],
            strategy: 'Risk-off: reduce exposure, wait for structure change. Resist buying rallies.',
        };
    }

    // 3. ACCUMULATION: low volume + sideways + RSI 40-55
    if (isSideways && isLowVolume && rsi >= 40 && rsi <= 55) {
        return {
            phase: 'accumulation',
            label: '🟡 Accumulation',
            explanation: `Market is in an accumulation phase. Price consolidating in a ${priceRange.toFixed(1)}% range with declining volume (${(volumeRatio * 100 - 100).toFixed(0)}% below avg). RSI at ${rsi.toFixed(1)} is neutral, suggesting smart money may be quietly building positions. Historical pattern: accumulation phases often precede significant upward breakouts.`,
            icon: '📦',
            criteria,
            characteristics: [
                'Tight price range with declining volume',
                'RSI neutral (40-55) — no clear directional bias',
                'Smart money potentially building positions',
                'Breakout direction uncertain — watch for volume surge',
            ],
            strategy: 'Wait for breakout confirmation with volume. Set alerts at range boundaries.',
        };
    }

    // 4. DISTRIBUTION: high volume + sideways + RSI 55-70
    if (isSideways && isHighVolume && rsi >= 55 && rsi <= 70) {
        return {
            phase: 'distribution',
            label: '🟠 Distribution',
            explanation: `Market showing distribution characteristics. Price moving sideways in a ${priceRange.toFixed(1)}% range but with elevated volume (${((volumeRatio - 1) * 100).toFixed(0)}% above avg). RSI at ${rsi.toFixed(1)} suggests selling pressure building. Institutions may be offloading positions to retail buyers. Watch for a breakdown below the range.`,
            icon: '📤',
            criteria,
            characteristics: [
                'Sideways price action with high volume',
                'RSI mildly overbought (55-70)',
                'Potential institutional selling into strength',
                'Risk of breakdown if support fails',
            ],
            strategy: 'Reduce position sizes. Set stop-losses below range support. Be cautious adding.',
        };
    }

    // 5. TRANSITION — doesn't fit cleanly
    return {
        phase: 'transition',
        label: '⚪ Transition',
        explanation: `Market in a transitional phase between major cycles. ${priceAboveEMA200 ? 'Price is above EMA200' : 'Price is below EMA200'}, ${goldenCross ? 'EMA50 above EMA200' : 'EMA50 below EMA200'}. RSI at ${rsi?.toFixed(1) || 'N/A'}. Volume ${isHighVolume ? 'elevated' : isLowVolume ? 'declining' : 'average'}. The market is building structure — wait for a clear trend before committing.`,
        icon: '🔄',
        criteria,
        characteristics: [
            'Mixed signals — no clear trend dominance',
            'Moving averages may be converging',
            'Previous trend may be ending',
            'New trend may be forming',
        ],
        strategy: 'Reduce position sizes. Wait for clarity. Trade only clear setups with tight stops.',
    };
}

// ─── Helpers ────────────────────────────────────────────

function buildBullExplanation(price, ema50, ema200, rsi) {
    return `Strong bull market structure confirmed. Bitcoin is trading at $${price.toFixed(0)}, above both the 50-day EMA ($${ema50?.toFixed(0) || 'N/A'}) and 200-day EMA ($${ema200?.toFixed(0) || 'N/A'}). The golden cross (EMA50 > EMA200) signals sustained upward momentum. RSI at ${rsi?.toFixed(1) || 'N/A'} ${rsi > 65 ? 'shows strong momentum but watch for overbought exhaustion.' : rsi < 45 ? 'is pulling back — potential dip-buying opportunity.' : 'shows healthy momentum with room to run.'}`;
}

function buildBearExplanation(price, ema50, ema200, rsi) {
    return `Bear market structure active. Bitcoin is trading at $${price.toFixed(0)}, below both the 50-day EMA ($${ema50?.toFixed(0) || 'N/A'}) and 200-day EMA ($${ema200?.toFixed(0) || 'N/A'}). The death cross (EMA50 < EMA200) confirms sustained downward pressure. RSI at ${rsi?.toFixed(1) || 'N/A'} ${rsi < 35 ? 'is oversold — a relief rally is possible, but the trend remains bearish.' : rsi > 55 ? 'shows a counter-trend bounce — likely to face resistance at EMAs.' : 'confirms weak momentum.'}`;
}

function computeEMA(closes, period) {
    try {
        if (closes.length < period) return null;
        const values = ti.EMA.calculate({ period, values: closes });
        return values.length > 0 ? values[values.length - 1] : null;
    } catch { return null; }
}

function computeRSI(closes) {
    try {
        const values = ti.RSI.calculate({ values: closes, period: 14 });
        return values.length > 0 ? values[values.length - 1] : null;
    } catch { return null; }
}

function round(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

module.exports = { classifyMarket };
