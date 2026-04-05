// ═══════════════════════════════════════════════════════════
// Model — PriceSnapshot (1-minute OHLCV history)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const priceSnapshotSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
        uppercase: true,
        default: 'BTCUSDT',
    },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    timestamp: {
        type: Date,
        required: true,
        index: true,
    },
    source: {
        type: String,
        enum: ['binance', 'coingecko', 'manual'],
        default: 'binance',
    },
}, {
    timestamps: true,
    collection: 'price_snapshots',
});

// Compound index for efficient time-range queries
priceSnapshotSchema.index({ symbol: 1, timestamp: -1 });

// TTL index — auto-delete data older than 90 days
priceSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

// Static: get recent candles for a symbol
priceSnapshotSchema.statics.getCandles = function (symbol, limit = 200) {
    return this.find({ symbol })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
        .then(docs => docs.reverse());
};

module.exports = mongoose.model('PriceSnapshot', priceSnapshotSchema);
