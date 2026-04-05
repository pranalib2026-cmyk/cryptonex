// ═══════════════════════════════════════════════════════════
// WebSocket Handler — streams live market data to clients
// ═══════════════════════════════════════════════════════════

const { WebSocketServer } = require('ws');
const binanceWs = require('../services/binanceWs');

let wss = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    console.log('  ✔ WebSocket server initialized at /ws');

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`  ↗ WS client connected from ${ip}`);

        // Send initial state
        const latestCandle = binanceWs.getLatestCandle();
        if (latestCandle) {
            ws.send(JSON.stringify({
                type: 'init',
                data: {
                    latestCandle,
                    recentCandles: binanceWs.getRecentCandles(50),
                },
                ts: Date.now(),
            }));
        }

        // Subscribe to Binance broadcast
        const unsubscribe = binanceWs.subscribe((message) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(message);
            }
        });

        // Handle client messages (e.g. subscribe to specific streams)
        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw);

                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
                }

                if (msg.type === 'subscribe') {
                    // Future: handle per-stream subscriptions
                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        channel: msg.channel,
                        ts: Date.now(),
                    }));
                }
            } catch (e) {
                // Ignore invalid messages
            }
        });

        ws.on('close', () => {
            unsubscribe();
            console.log(`  ↘ WS client disconnected`);
        });

        ws.on('error', (err) => {
            unsubscribe();
            console.error('  ✘ WS client error:', err.message);
        });

        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
            }
        }, 30000);

        ws.on('close', () => clearInterval(heartbeat));
    });

    return wss;
}

function getConnectionCount() {
    return wss ? wss.clients.size : 0;
}

module.exports = { initWebSocket, getConnectionCount };
