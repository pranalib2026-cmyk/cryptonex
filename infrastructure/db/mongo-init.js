// ═══════════════════════════════════════════════════
// MongoDB Initialization Script
// Creates indexes and seed data for CryptoNex
// ═══════════════════════════════════════════════════

db = db.getSiblingDB('cryptonex');

// ─── Collections ─────────────────────────────────
db.createCollection('pricesnapshots');
db.createCollection('newsarticles');
db.createCollection('portfolios');
db.createCollection('analysis_cache');

// ─── Indexes ─────────────────────────────────────
db.pricesnapshots.createIndex({ symbol: 1, timestamp: -1 });
db.pricesnapshots.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

db.newsarticles.createIndex({ publishedAt: -1 });
db.newsarticles.createIndex({ sentiment: 1, publishedAt: -1 });

db.portfolios.createIndex({ userId: 1, coin: 1 });

db.analysis_cache.createIndex({ symbol: 1, period: 1 }, { unique: true });
db.analysis_cache.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 14400 }); // 4 hours TTL

print('✔ CryptoNex database initialized with collections and indexes');
