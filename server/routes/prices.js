// ═══════════════════════════════════════════════════════════
// Route — /api/prices (live BTC price + multi-coin)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const coingecko = require('../services/coingecko');
const binanceWs = require('../services/binanceWs');

/**
 * GET /api/prices
 * Returns current BTC price, 24h stats, and live candle
 */
router.get('/', async (req, res, next) => {
    try {
        const [btcPrice, btcMarket] = await Promise.all([
            coingecko.getBtcPrice(),
            coingecko.getBtcMarketData(),
        ]);

        const liveCandle = binanceWs.getLatestCandle();

        res.json({
            success: true,
            data: {
                price: btcPrice,
                market: btcMarket,
                liveCandle,
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/prices/history?days=7
 * Returns BTC price history for charting
 */
router.get('/history', async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const history = await coingecko.getPriceHistory(days);

        res.json({
            success: true,
            data: history,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/prices/candles?limit=200
 * Returns recent candle data from Binance stream
 */
router.get('/candles', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const candles = binanceWs.getRecentCandles(limit);

        res.json({
            success: true,
            data: {
                candles,
                count: candles.length,
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
