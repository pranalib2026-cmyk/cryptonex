// ═══════════════════════════════════════════════════════════
// Route — /api/news (crypto news with sentiment)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const newsService = require('../services/newsService');

/**
 * GET /api/news?limit=20
 */
router.get('/', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const articles = await newsService.getNews(limit);

        res.json({
            success: true,
            data: {
                articles,
                count: articles.length,
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
