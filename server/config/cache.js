// ═══════════════════════════════════════════════════════════
// CryptoNex Backend — Cache Layer (In-Memory with optional Redis)
// ═══════════════════════════════════════════════════════════

class MemoryCache {
    constructor() {
        this.store = new Map();
        // Sweep expired keys every 30 seconds
        this._interval = setInterval(() => this._sweep(), 30000);
    }

    async get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key, value, ttlSeconds = 60) {
        this.store.set(key, {
            value,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    async del(key) {
        this.store.delete(key);
    }

    _sweep() {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiry) this.store.delete(key);
        }
    }

    close() {
        clearInterval(this._interval);
    }
}

// Singleton instance
const cache = new MemoryCache();

console.log('  ✔ In-memory cache initialized');

module.exports = cache;
