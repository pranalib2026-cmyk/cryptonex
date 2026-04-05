// ═══════════════════════════════════════════════════════════
// Smart Score — Composite Sentiment + Technical Aggregation
// Combines Fear & Greed with technical signals for a
// single 0–100 "Smart Score"
// ═══════════════════════════════════════════════════════════

const { getFearGreedIndex } = require('./fearGreed');

/**
 * @typedef {Object} SmartScoreResult
 * @property {number} score          0-100 composite score
 * @property {string} label          Human-readable label
 * @property {string} color          UI color code
 * @property {Object} breakdown      Weighted components
 * @property {Object} fearGreed      Raw Fear & Greed data
 * @property {string} interpretation Explanatory text
 */

/**
 * Compute composite Smart Score
 * @param {Object} technicalSignal  Output from technicalAnalysis.analyzeMarket()
 * @returns {Promise<SmartScoreResult>}
 */
async function computeSmartScore(technicalSignal) {
    // ─── 1. Get Fear & Greed ─────────────────────────
    const fng = await getFearGreedIndex();
    const fngScore = fng.value; // 0-100

    // ─── 2. Map Fear & Greed to label ────────────────
    const fngLabel = mapFearGreedLabel(fngScore);

    // ─── 3. Convert technical signal to 0-100 ────────
    let techScore = 50; // neutral baseline
    if (technicalSignal) {
        const { signal, confidence, scoring } = technicalSignal;

        if (signal === 'BULLISH') {
            techScore = 50 + (confidence / 2);
        } else if (signal === 'BEARISH') {
            techScore = 50 - (confidence / 2);
        } else {
            techScore = 50 + (scoring?.netScore || 0) / 5;
        }

        // Clamp
        techScore = Math.max(0, Math.min(100, techScore));
    }

    // ─── 4. RSI-based momentum score ─────────────────
    let momentumScore = 50;
    const rsi = technicalSignal?.indicators?.rsi;
    if (rsi !== null && rsi !== undefined) {
        // RSI > 50 = bullish momentum, RSI < 50 = bearish
        momentumScore = rsi;
    }

    // ─── 5. Weighted composite ───────────────────────
    //   Technical Analysis: 45%
    //   Fear & Greed:       30%
    //   Momentum (RSI):     25%
    const weights = {
        technical: 0.45,
        fearGreed: 0.30,
        momentum: 0.25,
    };

    // For F&G, extreme fear is contrarian bullish, extreme greed is contrarian bearish
    // We use the raw value (not contrarian) for Smart Score
    const compositeScore = Math.round(
        techScore * weights.technical +
        fngScore * weights.fearGreed +
        momentumScore * weights.momentum
    );

    const finalScore = Math.max(0, Math.min(100, compositeScore));

    // ─── 6. Generate label and color ─────────────────
    const { label, color, textColor } = getScoreLabel(finalScore);

    // ─── 7. Contrarian indicator ─────────────────────
    const contrarian = getContrarianView(fngScore, techScore);

    // ─── 8. Interpretation text ──────────────────────
    const interpretation = buildInterpretation(finalScore, fngScore, fngLabel, techScore, momentumScore);

    return {
        score: finalScore,
        label,
        color,
        textColor,
        breakdown: {
            technical: { score: round(techScore), weight: weights.technical, signal: technicalSignal?.signal || 'N/A' },
            fearGreed: { score: fngScore, weight: weights.fearGreed, label: fngLabel },
            momentum: { score: round(momentumScore), weight: weights.momentum },
        },
        contrarian,
        fearGreed: {
            value: fngScore,
            label: fngLabel,
            history: fng.history?.slice(0, 7) || [],
        },
        interpretation,
        timestamp: Date.now(),
    };
}

function mapFearGreedLabel(score) {
    if (score <= 25) return 'Extreme Fear';
    if (score <= 45) return 'Fear';
    if (score <= 55) return 'Neutral';
    if (score <= 75) return 'Greed';
    return 'Extreme Greed';
}

function getScoreLabel(score) {
    if (score >= 80) return { label: 'Strong Bullish', color: '#10B981', textColor: '#ECFDF5' };
    if (score >= 65) return { label: 'Bullish', color: '#34D399', textColor: '#F0FDF4' };
    if (score >= 55) return { label: 'Slightly Bullish', color: '#6EE7B7', textColor: '#1a1a2e' };
    if (score >= 45) return { label: 'Neutral', color: '#FBBF24', textColor: '#1a1a2e' };
    if (score >= 35) return { label: 'Slightly Bearish', color: '#FB923C', textColor: '#1a1a2e' };
    if (score >= 20) return { label: 'Bearish', color: '#EF4444', textColor: '#FEF2F2' };
    return { label: 'Strong Bearish', color: '#DC2626', textColor: '#FEF2F2' };
}

function getContrarianView(fngScore, techScore) {
    // Warren Buffett: "Be greedy when others are fearful"
    if (fngScore <= 20 && techScore >= 45) {
        return {
            signal: 'CONTRARIAN_BUY',
            text: 'Extreme fear with neutral/positive technicals — historically strong buy zone',
            strength: 'strong',
        };
    }
    if (fngScore <= 30 && techScore >= 40) {
        return {
            signal: 'CONTRARIAN_BUY',
            text: 'High fear with stable technicals — potential opportunity',
            strength: 'moderate',
        };
    }
    if (fngScore >= 80 && techScore <= 55) {
        return {
            signal: 'CONTRARIAN_SELL',
            text: 'Extreme greed with weakening technicals — historically risky zone',
            strength: 'strong',
        };
    }
    if (fngScore >= 70 && techScore <= 50) {
        return {
            signal: 'CONTRARIAN_SELL',
            text: 'High greed with neutral technicals — exercise caution',
            strength: 'moderate',
        };
    }

    return {
        signal: 'NONE',
        text: 'No strong contrarian signal at this time',
        strength: 'none',
    };
}

function buildInterpretation(score, fng, fngLabel, tech, momentum) {
    const parts = [];

    parts.push(`The CryptoNex Smart Score is ${score}/100 (${getScoreLabel(score).label}).`);

    parts.push(`Market sentiment (Fear & Greed) reads ${fng} (${fngLabel}), contributing ${Math.round(fng * 0.30)} points.`);

    parts.push(`Technical analysis scores ${Math.round(tech)} (${tech > 60 ? 'bullish' : tech < 40 ? 'bearish' : 'neutral'} setup), contributing ${Math.round(tech * 0.45)} points.`);

    parts.push(`Momentum (RSI-based) scores ${Math.round(momentum)}, contributing ${Math.round(momentum * 0.25)} points.`);

    if (score >= 70) {
        parts.push('Overall: conditions are favorable for Bitcoin. Technical structure supports upside continuation.');
    } else if (score <= 30) {
        parts.push('Overall: conditions are challenging. Caution warranted — consider reducing exposure or waiting for improvement.');
    } else {
        parts.push('Overall: mixed signals — market at an inflection point. Wait for stronger directional confirmation.');
    }

    return parts.join(' ');
}

function round(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

module.exports = { computeSmartScore, mapFearGreedLabel };
