// ═══════════════════════════════════════════════════════════
//  CryptoNex Backend — Main Server Entry Point
//  Node.js + Express + WebSocket + MongoDB
// ═══════════════════════════════════════════════════════════

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { initWebSocket, getConnectionCount } = require('./websocket/wsHandler');
const binanceWs = require('./services/binanceWs');
const { startScheduler, stopScheduler, getSchedulerStatus } = require('./scheduler/analysisScheduler');

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT) || 3001;

// ─── MIDDLEWARE ──────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', apiLimiter);

// Request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
        if (req.path.startsWith('/api')) {
            console.log(`  → ${req.method} ${req.path}`);
        }
        next();
    });
}

// ─── ROUTES ─────────────────────────────────────────────
app.use('/api/prices', require('./routes/prices'));
app.use('/api/market-overview', require('./routes/market'));
app.use('/api/news', require('./routes/news'));
app.use('/api/sentiment', require('./routes/sentiment'));
app.use('/api/indicators', require('./routes/indicators'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/analyze', require('./routes/analyze'));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        wsClients: getConnectionCount(),
        scheduler: getSchedulerStatus(),
        timestamp: Date.now(),
    });
});

// 404
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// ─── STARTUP ────────────────────────────────────────────
async function start() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   CryptoNex Backend — Starting Up...     ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');

    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Initialize WebSocket server
    initWebSocket(server);

    // 3. Connect to Binance WebSocket stream
    binanceWs.connect();

    // 4. Start analysis scheduler (every 4 hours)
    startScheduler();

    // 5. Start HTTP server
    server.listen(PORT, () => {
        console.log('');
        console.log(`  ✔ HTTP server running on http://localhost:${PORT}`);
        console.log(`  ✔ WebSocket available at  ws://localhost:${PORT}/ws`);
        console.log('');
        console.log('  ┌──────────────────────────────────────────┐');
        console.log('  │  REST Endpoints:                         │');
        console.log(`  │  GET  /api/prices          (live BTC)    │`);
        console.log(`  │  GET  /api/prices/history   (chart)      │`);
        console.log(`  │  GET  /api/prices/candles   (OHLCV)      │`);
        console.log(`  │  GET  /api/market-overview  (all)        │`);
        console.log(`  │  GET  /api/news             (feed)       │`);
        console.log(`  │  GET  /api/sentiment         (F&G)       │`);
        console.log(`  │  GET  /api/indicators        (TA)        │`);
        console.log(`  │  CRUD /api/portfolio         (wallet)    │`);
        console.log(`  │  POST /api/analyze          (AI engine)  │`);
        console.log(`  │  GET  /api/analyze/summary   (quick)     │`);
        console.log(`  │  GET  /api/health            (status)    │`);
        console.log('  └──────────────────────────────────────────┘');
        console.log('');
    });
}

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n  ⚠ Shutting down gracefully...');
    stopScheduler();
    binanceWs.disconnect();
    server.close(() => {
        console.log('  ✔ Server closed');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
}

start().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
