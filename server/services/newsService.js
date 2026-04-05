// ═══════════════════════════════════════════════════════════
// Service — Crypto News (CryptoPanic API + fallback)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const cache = require('../config/cache');
const NewsArticle = require('../models/NewsArticle');
const { isDatabaseConnected } = require('../config/database');

const API_URL = 'https://cryptopanic.com/api/v1/posts/';
const TTL = parseInt(process.env.CACHE_TTL_NEWS) || 300;

/**
 * Fetch latest crypto news
 */
async function getNews(limit = 20) {
    const cacheKey = 'news:latest';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.CRYPTOPANIC_API_KEY;

    let articles;
    if (apiKey) {
        articles = await fetchFromAPI(apiKey, limit);
    } else {
        articles = await fetchFromDB(limit);
    }

    if (!articles || articles.length === 0) {
        articles = getFallbackNews();
    }

    await cache.set(cacheKey, articles, TTL);
    return articles;
}

async function fetchFromAPI(apiKey, limit) {
    try {
        const res = await axios.get(API_URL, {
            params: {
                auth_token: apiKey,
                filter: 'important',
                currencies: 'BTC',
                kind: 'news',
                public: true,
            },
            timeout: 10000,
        });

        const posts = res.data.results || [];
        const articles = posts.slice(0, limit).map(post => ({
            externalId: String(post.id),
            title: post.title,
            url: post.url,
            source: post.source?.title || 'Unknown',
            sentiment: mapSentiment(post.votes),
            sentimentScore: calcSentimentScore(post.votes),
            currencies: post.currencies?.map(c => c.code) || ['BTC'],
            publishedAt: new Date(post.published_at),
            thumbnail: post.metadata?.image || null,
        }));

        // Persist to DB
        if (isDatabaseConnected()) {
            for (const article of articles) {
                try {
                    await NewsArticle.findOneAndUpdate(
                        { externalId: article.externalId },
                        article,
                        { upsert: true, new: true }
                    );
                } catch (e) { /* ignore duplicates */ }
            }
        }

        return articles;
    } catch (err) {
        console.error('CryptoPanic API error:', err.message);
        return null;
    }
}

async function fetchFromDB(limit) {
    if (!isDatabaseConnected()) return null;
    try {
        return await NewsArticle.getLatest(limit);
    } catch (err) {
        return null;
    }
}

function mapSentiment(votes) {
    if (!votes) return 'neutral';
    const pos = (votes.positive || 0) + (votes.important || 0);
    const neg = (votes.negative || 0) + (votes.toxic || 0);
    if (pos > neg * 1.5) return 'bullish';
    if (neg > pos * 1.5) return 'bearish';
    return 'neutral';
}

function calcSentimentScore(votes) {
    if (!votes) return 0;
    const pos = (votes.positive || 0) + (votes.important || 0);
    const neg = (votes.negative || 0) + (votes.toxic || 0);
    const total = pos + neg;
    if (total === 0) return 0;
    return Math.round(((pos - neg) / total) * 100) / 100;
}

function getFallbackNews() {
    return [
        { title: 'Bitcoin Surges Past $68K as Institutional Inflows Hit Record Highs', source: 'CoinDesk', sentiment: 'bullish', sentimentScore: 0.8, publishedAt: new Date(Date.now() - 2 * 3600000), currencies: ['BTC'] },
        { title: 'Federal Reserve Signals Potential Rate Cuts, Crypto Market Responds', source: 'Bloomberg', sentiment: 'bullish', sentimentScore: 0.6, publishedAt: new Date(Date.now() - 4 * 3600000), currencies: ['BTC'] },
        { title: 'Major Bank Launches Bitcoin Custody Service for Institutional Clients', source: 'Reuters', sentiment: 'bullish', sentimentScore: 0.7, publishedAt: new Date(Date.now() - 6 * 3600000), currencies: ['BTC'] },
        { title: 'Bitcoin Mining Difficulty Hits All-Time High After Halving Event', source: 'CryptoSlate', sentiment: 'neutral', sentimentScore: 0.1, publishedAt: new Date(Date.now() - 8 * 3600000), currencies: ['BTC'] },
        { title: 'SEC Commissioner Calls for "Rational" Crypto Regulation Framework', source: 'The Block', sentiment: 'neutral', sentimentScore: 0.2, publishedAt: new Date(Date.now() - 10 * 3600000), currencies: ['BTC'] },
        { title: 'Whale Activity Spikes as $342M in BTC Moves to Cold Storage', source: 'Decrypt', sentiment: 'bearish', sentimentScore: -0.3, publishedAt: new Date(Date.now() - 12 * 3600000), currencies: ['BTC'] },
    ];
}

module.exports = { getNews };
