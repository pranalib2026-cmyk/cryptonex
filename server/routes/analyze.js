// ═══════════════════════════════════════════════════════════
// Route — POST /api/analyze (full analysis pipeline)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { runAnalysis } = require('../services/analysisEngine');

/**
 * POST /api/analyze
 * Body: { symbol?: "BTCUSDT", period?: "90d" }
 * Returns: complete analysis with TA, prediction, market condition, smart score
 */
router.post('/', async (req, res, next) => {
    try {
        const { symbol = 'BTCUSDT', period = '90d' } = req.body || {};

        // Validate symbol
        const validSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '');
        if (!validSymbol) {
            return res.status(400).json({ success: false, error: 'Invalid symbol' });
        }

        // Validate period
        const days = parseInt(period);
        if (isNaN(days) || days < 7 || days > 365) {
            return res.status(400).json({ success: false, error: 'Period must be between 7d and 365d' });
        }

        const result = await runAnalysis(validSymbol, `${days}d`);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/analyze
 * Quick analysis with defaults (BTCUSDT, 90d)
 */
router.get('/', async (_req, res, next) => {
    try {
        const result = await runAnalysis('BTCUSDT', '90d');
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/analyze/summary
 * Returns just the summary lines (for dashboard widgets)
 */
router.get('/summary', async (_req, res, next) => {
    try {
        const result = await runAnalysis('BTCUSDT', '90d');
        res.json({
            success: true,
            data: {
                signal: result.technicalAnalysis?.signal,
                confidence: result.technicalAnalysis?.confidence,
                smartScore: result.smartScore?.score,
                smartLabel: result.smartScore?.label,
                marketPhase: result.marketCondition?.label,
                trendDirection: result.prediction?.trend?.direction,
                summary: result.summary,
                support: result.technicalAnalysis?.support,
                resistance: result.technicalAnalysis?.resistance,
                currentPrice: result.currentPrice,
                timestamp: result.timestamp,
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
