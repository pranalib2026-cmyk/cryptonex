// ═══════════════════════════════════════════════════════════
// Middleware — Rate Limiter (Express)
// ═══════════════════════════════════════════════════════════

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120,                 // 120 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests. Please try again later.',
    },
});

const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Rate limit exceeded. Please slow down.',
    },
});

module.exports = { apiLimiter, strictLimiter };
