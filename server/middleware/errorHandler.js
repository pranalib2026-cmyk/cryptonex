// ═══════════════════════════════════════════════════════════
// Middleware — Global Error Handler
// ═══════════════════════════════════════════════════════════

function errorHandler(err, req, res, _next) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: messages,
        });
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format',
        });
    }

    // Axios error (external API failure)
    if (err.isAxiosError) {
        return res.status(502).json({
            success: false,
            error: 'External API unavailable',
            service: err.config?.baseURL || 'unknown',
        });
    }

    // Default
    const status = err.statusCode || err.status || 500;
    res.status(status).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
}

module.exports = errorHandler;
