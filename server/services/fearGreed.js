// ═══════════════════════════════════════════════════════════
// Service — Fear & Greed Index (Alternative.me)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const cache = require('../config/cache');

const API_URL = 'https://api.alternative.me/fng/';
const TTL = parseInt(process.env.CACHE_TTL_SENTIMENT) || 60;

/**
 * Get current Fear & Greed index + historical data
 */
async function getFearGreedIndex() {
    const cacheKey = 'fng:current';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const res = await axios.get(API_URL, {
            params: { limit: 30, format: 'json' },
            timeout: 8000,
        });

        const entries = res.data.data;
        if (!entries || entries.length === 0) return getFallback();

        const current = entries[0];
        const result = {
            value: parseInt(current.value),
            label: current.value_classification,
            timestamp: parseInt(current.timestamp) * 1000,
            history: entries.slice(0, 30).map(e => ({
                value: parseInt(e.value),
                label: e.value_classification,
                timestamp: parseInt(e.timestamp) * 1000,
            })),
        };

        await cache.set(cacheKey, result, TTL);
        return result;
    } catch (err) {
        console.error('Fear & Greed API error:', err.message);
        return getFallback();
    }
}

function getFallback() {
    return {
        value: 72,
        label: 'Greed',
        timestamp: Date.now(),
        history: [],
        _fallback: true,
    };
}

module.exports = { getFearGreedIndex };
