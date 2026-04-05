// ═══════════════════════════════════════════════════════════
// Route — /api/market-overview (all tracked assets)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const coingecko = require('../services/coingecko');
const forexService = require('../services/forexService');

/**
 * GET /api/market-overview
 * Returns all dashboard asset prices plus Indian market & forex
 */
router.get('/', async (req, res, next) => {
    try {
        const [
            coins,
            usdInr,
            gold,
            indianMarket,
        ] = await Promise.allSettled([
            coingecko.getMultipleCoins(['bitcoin', 'ethereum', 'binancecoin', 'solana', 'dogecoin']),
            forexService.getUsdInr(),
            forexService.getGoldPrice(),
            forexService.getIndianMarket(),
        ]);

        res.json({
            success: true,
            data: {
                crypto: coins.status === 'fulfilled' ? coins.value : [],
                forex: usdInr.status === 'fulfilled' ? usdInr.value : null,
                gold: gold.status === 'fulfilled' ? gold.value : null,
                indianMarket: indianMarket.status === 'fulfilled' ? indianMarket.value : [],
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
