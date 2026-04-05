// ═══════════════════════════════════════════════════════════
// Route — /api/portfolio (CRUD user portfolio)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const { isDatabaseConnected } = require('../config/database');

/**
 * GET /api/portfolio?userId=default
 * Returns all holdings for a user
 */
router.get('/', async (req, res, next) => {
    try {
        if (!isDatabaseConnected()) {
            return res.json({
                success: true,
                data: { holdings: getFallbackPortfolio(), _fallback: true },
            });
        }

        const userId = req.query.userId || 'default';
        const holdings = await Portfolio.find({ userId }).sort({ coin: 1 }).lean();

        res.json({
            success: true,
            data: {
                holdings: holdings.length > 0 ? holdings : getFallbackPortfolio(),
                count: holdings.length,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/portfolio
 * Add a new coin holding
 * Body: { coin, coinName, quantity, buyPrice, buyDate?, notes? }
 */
router.post('/', async (req, res, next) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const { coin, coinName, quantity, buyPrice, buyDate, notes, userId } = req.body;

        if (!coin || !quantity || !buyPrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: coin, quantity, buyPrice',
            });
        }

        const holding = await Portfolio.create({
            userId: userId || 'default',
            coin: coin.toUpperCase(),
            coinName: coinName || coin,
            quantity: parseFloat(quantity),
            buyPrice: parseFloat(buyPrice),
            buyDate: buyDate ? new Date(buyDate) : new Date(),
            notes: notes || '',
        });

        res.status(201).json({
            success: true,
            data: holding,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/portfolio/:id
 * Update a holding
 */
router.put('/:id', async (req, res, next) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const updated = await Portfolio.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return res.status(404).json({ success: false, error: 'Holding not found' });
        }

        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/portfolio/:id
 * Remove a holding
 */
router.delete('/:id', async (req, res, next) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const deleted = await Portfolio.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Holding not found' });
        }

        res.json({ success: true, message: 'Holding removed' });
    } catch (err) {
        next(err);
    }
});

function getFallbackPortfolio() {
    return [
        { coin: 'BTC', coinName: 'Bitcoin', quantity: 1.5, buyPrice: 42000, buyDate: '2024-01-15' },
        { coin: 'ETH', coinName: 'Ethereum', quantity: 12, buyPrice: 2200, buyDate: '2024-02-01' },
        { coin: 'SOL', coinName: 'Solana', quantity: 50, buyPrice: 95, buyDate: '2024-03-10' },
    ];
}

module.exports = router;
