// ═══════════════════════════════════════════════════════════
// Service — Binance WebSocket (real-time OHLCV stream)
// ═══════════════════════════════════════════════════════════

const WebSocket = require('ws');
const PriceSnapshot = require('../models/PriceSnapshot');
const { isDatabaseConnected } = require('../config/database');

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

let binanceWs = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// In-memory latest candle + recent history
const latestCandle = { symbol: 'BTCUSDT', data: null };
const recentCandles = []; // last 200 closed candles
const recentTrades = []; // last 50 trades
const MAX_CANDLES = 500;
const MAX_TRADES = 50;

// Subscribers (WebSocket clients to broadcast to)
const subscribers = new Set();

function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

function broadcast(type, data) {
    const message = JSON.stringify({ type, data, ts: Date.now() });
    for (const cb of subscribers) {
        try { cb(message); } catch (e) { /* ignore */ }
    }
}

function connect() {
    if (binanceWs && binanceWs.readyState === WebSocket.OPEN) return;

    const streams = [
        'btcusdt@kline_1m',    // 1-minute candles
        'btcusdt@trade',        // individual trades
        'btcusdt@ticker',       // 24h ticker
    ];

    const url = `${BINANCE_WS_URL}/${streams[0]}`;
    // Use combined stream for multiple
    const combinedUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;

    console.log('  ℹ Connecting to Binance WebSocket...');

    binanceWs = new WebSocket(combinedUrl);

    binanceWs.on('open', () => {
        console.log('  ✔ Binance WebSocket connected');
        reconnectAttempts = 0;
    });

    binanceWs.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            const { stream, data } = msg;

            if (!stream || !data) return;

            if (stream.includes('@kline')) {
                handleKline(data);
            } else if (stream.includes('@trade')) {
                handleTrade(data);
            } else if (stream.includes('@ticker')) {
                handleTicker(data);
            }
        } catch (err) {
            // Ignore parse errors
        }
    });

    binanceWs.on('error', (err) => {
        console.error('  ✘ Binance WS error:', err.message);
    });

    binanceWs.on('close', (code) => {
        console.log(`  ⚠ Binance WS closed (code: ${code}). Reconnecting...`);
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    reconnectTimer = setTimeout(connect, delay);
}

function handleKline(data) {
    const k = data.k;
    const candle = {
        symbol: k.s,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        timestamp: new Date(k.t),
        isClosed: k.x,
        trades: k.n,
    };

    latestCandle.data = candle;

    // Broadcast to frontend
    broadcast('candle', candle);

    // If candle is closed, store it
    if (candle.isClosed) {
        recentCandles.push(candle);
        if (recentCandles.length > MAX_CANDLES) recentCandles.shift();

        // Persist to MongoDB
        if (isDatabaseConnected()) {
            PriceSnapshot.create({
                symbol: candle.symbol,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
                timestamp: candle.timestamp,
                source: 'binance',
            }).catch(err => {
                // Ignore duplicate key errors
                if (err.code !== 11000) {
                    console.error('DB save error:', err.message);
                }
            });
        }
    }
}

function handleTrade(data) {
    const trade = {
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        time: data.T,
        isBuyerMaker: data.m,
    };

    recentTrades.push(trade);
    if (recentTrades.length > MAX_TRADES) recentTrades.shift();

    // Only broadcast every 10th trade to reduce noise
    if (recentTrades.length % 10 === 0) {
        broadcast('trade', trade);
    }
}

function handleTicker(data) {
    const ticker = {
        symbol: data.s,
        price: parseFloat(data.c),
        change: parseFloat(data.p),
        changePct: parseFloat(data.P),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        volume: parseFloat(data.v),
        quoteVolume: parseFloat(data.q),
    };

    broadcast('ticker', ticker);
}

function getLatestCandle() {
    return latestCandle.data;
}

function getRecentCandles(limit = 200) {
    return recentCandles.slice(-limit);
}

function getRecentTrades(limit = 50) {
    return recentTrades.slice(-limit);
}

function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (binanceWs) {
        binanceWs.close();
        binanceWs = null;
    }
}

module.exports = {
    connect,
    disconnect,
    subscribe,
    getLatestCandle,
    getRecentCandles,
    getRecentTrades,
};
