// ═══════════════════════════════════════════════════════════
// Route — /api/sentiment (Fear & Greed + whale alerts)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const fearGreed = require('../services/fearGreed');
const whaleAlert = require('../services/whaleAlert');

/**
 * GET /api/sentiment
 * Returns Fear & Greed Index, whale alerts, and social metrics
 */
router.get('/', async (req, res, next) => {
    try {
        const [fng, whales] = await Promise.allSettled([
            fearGreed.getFearGreedIndex(),
            whaleAlert.getWhaleAlerts(10),
        ]);

        // Simulated social sentiment (would come from Twitter/Reddit API in production)
        const socialSentiment = {
            twitter: { bullish: 62, bearish: 28, neutral: 10, trending: ['#Bitcoin', '#BTC', '#Crypto'] },
            reddit: { bullish: 55, bearish: 30, neutral: 15, activeSubreddits: ['r/Bitcoin', 'r/CryptoCurrency'] },
            telegram: { bullish: 58, bearish: 25, neutral: 17 },
            overall: 'bullish',
        };

        res.json({
            success: true,
            data: {
                fearGreed: fng.status === 'fulfilled' ? fng.value : null,
                whaleAlerts: whales.status === 'fulfilled' ? whales.value : [],
                social: socialSentiment,
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
