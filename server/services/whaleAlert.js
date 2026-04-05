// ═══════════════════════════════════════════════════════════
// Service — Whale Alert API (large BTC transactions)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const cache = require('../config/cache');

const API_URL = 'https://api.whale-alert.io/v1/transactions';

/**
 * Get recent whale transactions
 */
async function getWhaleAlerts(limit = 10) {
    const cacheKey = 'whale:alerts';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.WHALE_ALERT_API_KEY;
    if (!apiKey) return getFallback();

    try {
        const since = Math.floor(Date.now() / 1000) - 3600; // last 1 hour
        const res = await axios.get(API_URL, {
            params: {
                api_key: apiKey,
                min_value: 500000,
                currency: 'btc',
                start: since,
                limit,
            },
            timeout: 10000,
        });

        const txs = (res.data.transactions || []).map(tx => ({
            hash: tx.hash,
            amount: tx.amount,
            amountUsd: tx.amount_usd,
            from: tx.from?.owner_type || 'unknown',
            fromName: tx.from?.owner || null,
            to: tx.to?.owner_type || 'unknown',
            toName: tx.to?.owner || null,
            timestamp: tx.timestamp * 1000,
        }));

        await cache.set(cacheKey, txs, 60);
        return txs;
    } catch (err) {
        console.error('Whale Alert API error:', err.message);
        return getFallback();
    }
}

function getFallback() {
    const now = Date.now();
    return [
        { amount: 2400, amountUsd: 164200000, from: 'unknown', to: 'exchange', toName: 'Coinbase', timestamp: now - 3 * 60000 },
        { amount: 1850, amountUsd: 126500000, from: 'exchange', fromName: 'Binance', to: 'unknown', timestamp: now - 12 * 60000 },
        { amount: 5000, amountUsd: 342100000, from: 'unknown', to: 'unknown', timestamp: now - 28 * 60000 },
        { amount: 980, amountUsd: 67000000, from: 'exchange', fromName: 'Kraken', to: 'unknown', timestamp: now - 42 * 60000 },
        { amount: 3200, amountUsd: 218900000, from: 'exchange', fromName: 'Bitfinex', to: 'unknown', timestamp: now - 60 * 60000 },
        { amount: 1120, amountUsd: 76600000, from: 'unknown', to: 'exchange', toName: 'Binance', timestamp: now - 90 * 60000 },
    ].map(tx => ({ ...tx, _fallback: true }));
}

module.exports = { getWhaleAlerts };
