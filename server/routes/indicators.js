// ═══════════════════════════════════════════════════════════
// Route — /api/indicators (technical analysis)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const indicatorEngine = require('../services/indicatorEngine');

/**
 * GET /api/indicators
 * Returns all computed technical indicators for BTCUSDT
 */
router.get('/', async (req, res, next) => {
    try {
        const indicators = await indicatorEngine.computeIndicators();

        res.json({
            success: true,
            data: indicators,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
