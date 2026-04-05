// ═══════════════════════════════════════════════════════════
// Model — Portfolio (user coin holdings)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: {
        type: String,
        default: 'default',
        index: true,
    },
    coin: {
        type: String,
        required: true,
        uppercase: true,
    },
    coinName: {
        type: String,
        default: '',
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    buyPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    buyDate: {
        type: Date,
        default: Date.now,
    },
    notes: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
    collection: 'portfolios',
});

// Compound index
portfolioSchema.index({ userId: 1, coin: 1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);
