// ═══════════════════════════════════════════════════════════
// Service — CoinGecko API (BTC prices, market data, history)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const cache = require('../config/cache');

const BASE_URL = 'https://api.coingecko.com/api/v3';
const TTL = parseInt(process.env.CACHE_TTL_PRICES) || 5;

// Exponential backoff state
let backoffDelay = 0;
let lastErrorTime = 0;

async function request(path, params = {}) {
    // Respect backoff
    if (backoffDelay > 0 && Date.now() - lastErrorTime < backoffDelay) {
        throw new Error(`CoinGecko rate limited — retry in ${Math.round(backoffDelay / 1000)}s`);
    }

    try {
        const headers = {};
        if (process.env.COINGECKO_API_KEY) {
            headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
        }

        const res = await axios.get(`${BASE_URL}${path}`, {
            params,
            headers,
            timeout: 10000,
        });

        // Reset backoff on success
        backoffDelay = 0;
        return res.data;
    } catch (err) {
        if (err.response?.status === 429) {
            backoffDelay = Math.min((backoffDelay || 1000) * 2, 60000);
            lastErrorTime = Date.now();
            console.warn(`⚠ CoinGecko 429 — backoff ${backoffDelay / 1000}s`);
        }
        throw err;
    }
}

/**
 * Get live BTC price, market cap, volume, 24h change
 */
async function getBtcPrice() {
    const cacheKey = 'cg:btc:price';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const data = await request('/simple/price', {
            ids: 'bitcoin',
            vs_currencies: 'usd,inr',
            include_market_cap: true,
            include_24hr_vol: true,
            include_24hr_change: true,
            include_last_updated_at: true,
        });

        const btc = data.bitcoin;
        const result = {
            usd: btc.usd,
            inr: btc.inr,
            usd_market_cap: btc.usd_market_cap,
            usd_24h_vol: btc.usd_24h_vol,
            usd_24h_change: btc.usd_24h_change,
            inr_24h_change: btc.inr_24h_change,
            last_updated_at: btc.last_updated_at,
        };

        await cache.set(cacheKey, result, TTL);
        return result;
    } catch (err) {
        console.error('CoinGecko getBtcPrice error:', err.message);
        return getFallbackPrice();
    }
}

/**
 * Get detailed BTC market data (high/low, ATH, circulating supply, etc.)
 */
async function getBtcMarketData() {
    const cacheKey = 'cg:btc:market';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const [data] = await request('/coins/markets', {
            vs_currency: 'usd',
            ids: 'bitcoin',
            sparkline: true,
            price_change_percentage: '1h,24h,7d,30d',
        });

        const result = {
            price: data.current_price,
            market_cap: data.market_cap,
            market_cap_rank: data.market_cap_rank,
            total_volume: data.total_volume,
            high_24h: data.high_24h,
            low_24h: data.low_24h,
            price_change_24h: data.price_change_24h,
            price_change_pct_1h: data.price_change_percentage_1h_in_currency,
            price_change_pct_24h: data.price_change_percentage_24h_in_currency,
            price_change_pct_7d: data.price_change_percentage_7d_in_currency,
            price_change_pct_30d: data.price_change_percentage_30d_in_currency,
            circulating_supply: data.circulating_supply,
            total_supply: data.total_supply,
            ath: data.ath,
            ath_date: data.ath_date,
            sparkline_7d: data.sparkline_in_7d?.price || [],
            last_updated: data.last_updated,
        };

        await cache.set(cacheKey, result, 15);
        return result;
    } catch (err) {
        console.error('CoinGecko getBtcMarketData error:', err.message);
        return null;
    }
}

/**
 * Get price history (for chart data)
 * @param {number} days - 1, 7, 14, 30, 90, 180, 365, max
 */
async function getPriceHistory(days = 7) {
    const cacheKey = `cg:btc:history:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const data = await request('/coins/bitcoin/market_chart', {
            vs_currency: 'usd',
            days,
            interval: days <= 1 ? undefined : 'daily',
        });

        const result = {
            prices: data.prices, // [[timestamp, price], ...]
            volumes: data.total_volumes,
            market_caps: data.market_caps,
        };

        const ttl = days <= 1 ? 30 : 300;
        await cache.set(cacheKey, result, ttl);
        return result;
    } catch (err) {
        console.error('CoinGecko getPriceHistory error:', err.message);
        return { prices: [], volumes: [], market_caps: [] };
    }
}

/**
 * Get multiple coin prices at once
 */
async function getMultipleCoins(ids = ['bitcoin', 'ethereum', 'binancecoin', 'solana']) {
    const cacheKey = `cg:multi:${ids.join(',')}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const data = await request('/coins/markets', {
            vs_currency: 'usd',
            ids: ids.join(','),
            sparkline: true,
            price_change_percentage: '24h,7d',
        });

        const result = data.map(coin => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price,
            change_24h: coin.price_change_percentage_24h,
            change_7d: coin.price_change_percentage_7d_in_currency,
            market_cap: coin.market_cap,
            volume: coin.total_volume,
            sparkline: coin.sparkline_in_7d?.price || [],
            image: coin.image,
        }));

        await cache.set(cacheKey, result, 15);
        return result;
    } catch (err) {
        console.error('CoinGecko getMultipleCoins error:', err.message);
        return [];
    }
}

function getFallbackPrice() {
    return {
        usd: 68432.17,
        inr: 5712480,
        usd_market_cap: 1345000000000,
        usd_24h_vol: 28500000000,
        usd_24h_change: 2.34,
        inr_24h_change: 2.41,
        last_updated_at: Math.floor(Date.now() / 1000),
        _fallback: true,
    };
}

module.exports = {
    getBtcPrice,
    getBtcMarketData,
    getPriceHistory,
    getMultipleCoins,
};
