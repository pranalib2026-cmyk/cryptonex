// ═══════════════════════════════════════════════════════════
// Model — NewsArticle (crypto news with sentiment scoring)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const newsArticleSchema = new mongoose.Schema({
    externalId: {
        type: String,
        unique: true,
        sparse: true,
    },
    title: {
        type: String,
        required: true,
    },
    url: {
        type: String,
    },
    source: {
        type: String,
        default: 'Unknown',
    },
    sentiment: {
        type: String,
        enum: ['bullish', 'bearish', 'neutral'],
        default: 'neutral',
        index: true,
    },
    sentimentScore: {
        type: Number,
        min: -1,
        max: 1,
        default: 0,
    },
    currencies: [{
        type: String,
        uppercase: true,
    }],
    publishedAt: {
        type: Date,
        index: true,
    },
    thumbnail: {
        type: String,
    },
}, {
    timestamps: true,
    collection: 'news_articles',
});

// TTL — auto-delete articles older than 30 days
newsArticleSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

// Static: get latest news
newsArticleSchema.statics.getLatest = function (limit = 20) {
    return this.find()
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.model('NewsArticle', newsArticleSchema);
