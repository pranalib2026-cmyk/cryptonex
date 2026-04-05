/* ═══════════════════════════════════════════════════════════
   CryptoNex — App Logic & Data
   ═══════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── UTILITY HELPERS ───
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    function rand(min, max) { return Math.random() * (max - min) + min; }
    function randInt(min, max) { return Math.floor(rand(min, max)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function fmt(n, d = 2) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

    // ─── RAIN EFFECT ───
    function initRain() {
        const container = $('#rainContainer');
        const count = window.innerWidth < 640 ? 40 : 80;
        for (let i = 0; i < count; i++) {
            const drop = document.createElement('div');
            drop.classList.add('rain-drop');
            drop.style.left = rand(0, 100) + '%';
            drop.style.height = rand(15, 50) + 'px';
            drop.style.animationDuration = rand(1.5, 4) + 's';
            drop.style.animationDelay = rand(0, 5) + 's';
            drop.style.opacity = rand(0.15, 0.45);
            container.appendChild(drop);
        }
    }

    // ─── FLOATING COINS ───
    function initCoins() {
        const container = $('#floatingCoins');
        const count = window.innerWidth < 640 ? 5 : 12;
        for (let i = 0; i < count; i++) {
            const coin = document.createElement('div');
            coin.classList.add('btc-coin');
            coin.textContent = '₿';
            coin.style.left = rand(2, 95) + '%';
            coin.style.fontSize = rand(16, 36) + 'px';
            coin.style.animationDuration = rand(12, 30) + 's';
            coin.style.animationDelay = rand(0, 15) + 's';
            coin.style.animation += `, glowPulse ${rand(2, 5)}s ease-in-out ${rand(0, 3)}s infinite`;
            container.appendChild(coin);
        }
    }

    // ─── TICKER DATA ───
    const tickerData = [
        { symbol: 'BTC/USD', price: '$68,432.17', change: '+2.34%', up: true },
        { symbol: 'ETH/USD', price: '$3,821.45', change: '+1.87%', up: true },
        { symbol: 'BNB/USD', price: '$612.30', change: '-0.42%', up: false },
        { symbol: 'SOL/USD', price: '$178.92', change: '+5.21%', up: true },
        { symbol: 'XRP/USD', price: '$0.6234', change: '-1.13%', up: false },
        { symbol: 'ADA/USD', price: '$0.4812', change: '+0.78%', up: true },
        { symbol: 'DOGE/USD', price: '$0.1642', change: '+3.45%', up: true },
        { symbol: 'DOT/USD', price: '$7.84', change: '-0.91%', up: false },
        { symbol: 'AVAX/USD', price: '$38.56', change: '+2.14%', up: true },
        { symbol: 'LINK/USD', price: '$15.23', change: '+1.56%', up: true },
        { symbol: 'GOLD', price: '$2,342.80', change: '+0.32%', up: true },
        { symbol: 'NIFTY 50', price: '₹22,480', change: '+0.67%', up: true },
        { symbol: 'SENSEX', price: '₹73,890', change: '+0.54%', up: true },
        { symbol: 'USD/INR', price: '₹83.24', change: '-0.08%', up: false },
    ];

    function initTicker() {
        const track = $('#tickerTrack');
        const html = tickerData.map(t =>
            `<span class="ticker-item">
                <span class="ticker-symbol">${t.symbol}</span>
                <span class="ticker-price">${t.price}</span>
                <span class="ticker-change ${t.up ? 'positive' : 'negative'}">${t.change}</span>
            </span>
            <span class="ticker-sep">|</span>`
        ).join('');
        // Double it for seamless scrolling
        track.innerHTML = html + html;
    }

    // ─── MARKET OVERVIEW CARDS ───
    const marketData = [
        { symbol: 'BTC / USD', price: '$68,432', change: '+2.34%', up: true },
        { symbol: 'BTC / INR', price: '₹57,12,480', change: '+2.41%', up: true },
        { symbol: 'NIFTY 50', price: '₹22,480', change: '+0.67%', up: true },
        { symbol: 'SENSEX', price: '₹73,890', change: '+0.54%', up: true },
        { symbol: 'GOLD', price: '$2,342', change: '+0.32%', up: true },
        { symbol: 'USD / INR', price: '₹83.24', change: '-0.08%', up: false },
    ];

    function drawSparkline(canvas, data, color) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(dpr, dpr);

        const w = rect.width, h = rect.height;
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        ctx.beginPath();
        data.forEach((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / range) * (h * 0.8) - h * 0.1;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Fill gradient
        const lastX = w;
        const lastY = h - ((data[data.length - 1] - min) / range) * (h * 0.8) - h * 0.1;
        ctx.lineTo(lastX, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color.replace(')', ',0.2)').replace('rgb', 'rgba'));
        grad.addColorStop(1, color.replace(')', ',0)').replace('rgb', 'rgba'));
        ctx.fillStyle = grad;
        ctx.fill();
    }

    function generateSparkData(up) {
        const pts = [];
        let v = rand(50, 70);
        for (let i = 0; i < 20; i++) {
            v += rand(-3, 3) + (up ? 0.2 : -0.2);
            pts.push(v);
        }
        return pts;
    }

    function initMarketCards() {
        const container = $('#marketCards');
        container.innerHTML = marketData.map((m, idx) => {
            const dir = m.up ? 'up' : 'down';
            return `<div class="price-card ${dir}" style="animation: fadeSlideUp 0.5s ease-out ${idx * 0.08}s both">
                <div class="pc-header">
                    <span class="pc-symbol">${m.symbol}</span>
                    <span class="pc-change ${m.up ? 'positive' : 'negative'}">${m.change}</span>
                </div>
                <div class="pc-price">${m.price}</div>
                <div class="pc-sparkline"><canvas id="spark${idx}"></canvas></div>
            </div>`;
        }).join('');

        // Draw sparklines after DOM update
        requestAnimationFrame(() => {
            marketData.forEach((m, idx) => {
                const canvas = $(`#spark${idx}`);
                if (canvas) {
                    const data = generateSparkData(m.up);
                    drawSparkline(canvas, data, m.up ? '#22C55E' : '#EF4444');
                }
            });
        });
    }

    // ─── CANDLESTICK CHART (Canvas) ───
    function generateCandleData(n) {
        const candles = [];
        let open = 67200;
        for (let i = 0; i < n; i++) {
            const change = rand(-600, 650);
            const close = open + change;
            const high = Math.max(open, close) + rand(50, 400);
            const low = Math.min(open, close) - rand(50, 400);
            const vol = rand(500, 3000);
            candles.push({ open, close, high, low, vol });
            open = close;
        }
        return candles;
    }

    function drawCandlestick(canvas, data) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const pad = { top: 10, right: 10, bottom: 20, left: 60 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        const allHigh = Math.max(...data.map(d => d.high));
        const allLow = Math.min(...data.map(d => d.low));
        const range = allHigh - allLow || 1;

        const candleW = Math.max(2, (chartW / data.length) * 0.65);
        const gap = chartW / data.length;

        const yScale = (v) => pad.top + chartH - ((v - allLow) / range) * chartH;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = pad.top + (chartH / 5) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();

            // Price label
            const price = allHigh - (range / 5) * i;
            ctx.fillStyle = 'rgba(148,163,184,0.5)';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText('$' + fmt(price, 0), pad.left - 8, y + 4);
        }

        data.forEach((c, i) => {
            const x = pad.left + i * gap + gap / 2;
            const bullish = c.close >= c.open;
            const color = bullish ? '#22C55E' : '#EF4444';
            const glow = bullish ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, yScale(c.high));
            ctx.lineTo(x, yScale(c.low));
            ctx.stroke();

            // Body
            const bodyTop = yScale(Math.max(c.open, c.close));
            const bodyBottom = yScale(Math.min(c.open, c.close));
            const bodyH = Math.max(1, bodyBottom - bodyTop);

            ctx.fillStyle = color;
            ctx.shadowColor = glow;
            ctx.shadowBlur = 6;
            ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
            ctx.shadowBlur = 0;
        });
    }

    function drawVolume(canvas, data) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const pad = { left: 60, right: 10, top: 4, bottom: 4 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const maxVol = Math.max(...data.map(d => d.vol));
        const gap = chartW / data.length;
        const barW = Math.max(2, gap * 0.55);

        data.forEach((c, i) => {
            const x = pad.left + i * gap + gap / 2;
            const barH = (c.vol / maxVol) * chartH;
            const bullish = c.close >= c.open;
            ctx.fillStyle = bullish ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';
            ctx.fillRect(x - barW / 2, h - pad.bottom - barH, barW, barH);
        });
    }

    // ─── PREDICTION CHART ───
    function drawPrediction(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = Math.max(140, parent.clientHeight);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const pad = { top: 10, right: 10, bottom: 24, left: 50 };
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;

        // Generate prediction data with confidence bands
        const days = ['Today', '+1D', '+2D', '+3D', '+4D', '+5D', '+6D', '+7D'];
        const predicted = [68432, 68900, 69400, 69200, 70100, 70800, 71200, 71800];
        const upper = predicted.map(p => p + rand(400, 1200));
        const lower = predicted.map(p => p - rand(400, 1200));

        const allVals = [...upper, ...lower];
        const minV = Math.min(...allVals);
        const maxV = Math.max(...allVals);
        const range = maxV - minV || 1;

        const xScale = (i) => pad.left + (i / (days.length - 1)) * cw;
        const yScale = (v) => pad.top + ch - ((v - minV) / range) * ch;

        // Confidence band
        ctx.beginPath();
        for (let i = 0; i < days.length; i++) ctx.lineTo(xScale(i), yScale(upper[i]));
        for (let i = days.length - 1; i >= 0; i--) ctx.lineTo(xScale(i), yScale(lower[i]));
        ctx.closePath();
        const bandGrad = ctx.createLinearGradient(0, 0, 0, h);
        bandGrad.addColorStop(0, 'rgba(139,92,246,0.15)');
        bandGrad.addColorStop(1, 'rgba(139,92,246,0.02)');
        ctx.fillStyle = bandGrad;
        ctx.fill();

        // Upper band line
        ctx.beginPath();
        for (let i = 0; i < days.length; i++) {
            if (i === 0) ctx.moveTo(xScale(i), yScale(upper[i]));
            else ctx.lineTo(xScale(i), yScale(upper[i]));
        }
        ctx.strokeStyle = 'rgba(139,92,246,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lower band line
        ctx.beginPath();
        for (let i = 0; i < days.length; i++) {
            if (i === 0) ctx.moveTo(xScale(i), yScale(lower[i]));
            else ctx.lineTo(xScale(i), yScale(lower[i]));
        }
        ctx.stroke();

        // Main prediction line
        ctx.beginPath();
        for (let i = 0; i < days.length; i++) {
            if (i === 0) ctx.moveTo(xScale(i), yScale(predicted[i]));
            else ctx.lineTo(xScale(i), yScale(predicted[i]));
        }
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(139,92,246,0.5)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points
        predicted.forEach((v, i) => {
            ctx.beginPath();
            ctx.arc(xScale(i), yScale(v), 3, 0, Math.PI * 2);
            ctx.fillStyle = '#8B5CF6';
            ctx.fill();
            ctx.strokeStyle = '#0A0E1A';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // Day labels
        ctx.font = '10px Inter';
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.textAlign = 'center';
        days.forEach((d, i) => {
            ctx.fillText(d, xScale(i), h - 6);
        });

        // Dashed line at today
        ctx.beginPath();
        ctx.moveTo(xScale(0), pad.top);
        ctx.lineTo(xScale(0), pad.top + ch);
        ctx.strokeStyle = 'rgba(6,182,212,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ─── EXCHANGE FLOW CHART ───
    function drawFlowChart(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const days = 14;
        const inflow = Array.from({ length: days }, () => rand(600, 1800));
        const outflow = Array.from({ length: days }, () => rand(800, 2200));
        const maxVal = Math.max(...inflow, ...outflow);

        const pad = { left: 8, right: 8, top: 8, bottom: 8 };
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;
        const barTotal = cw / days;
        const barW = barTotal * 0.35;

        inflow.forEach((v, i) => {
            const x = pad.left + i * barTotal;
            const bh = (v / maxVal) * ch;
            ctx.fillStyle = 'rgba(239,68,68,0.5)';
            ctx.fillRect(x, h - pad.bottom - bh, barW, bh);
        });

        outflow.forEach((v, i) => {
            const x = pad.left + i * barTotal + barW + 2;
            const bh = (v / maxVal) * ch;
            ctx.fillStyle = 'rgba(34,197,94,0.5)';
            ctx.fillRect(x, h - pad.bottom - bh, barW, bh);
        });
    }

    // ─── WHALE FEED ───
    const whaleAlerts = [
        { amount: '2,400 BTC', detail: 'Unknown → Coinbase', time: '3 min ago', usd: '$164.2M' },
        { amount: '1,850 BTC', detail: 'Binance → Cold Wallet', time: '12 min ago', usd: '$126.5M' },
        { amount: '5,000 BTC', detail: 'Unknown → Unknown', time: '28 min ago', usd: '$342.1M' },
        { amount: '980 BTC', detail: 'Kraken → Unknown', time: '42 min ago', usd: '$67.0M' },
        { amount: '3,200 BTC', detail: 'Bitfinex → Cold Wallet', time: '1 hour ago', usd: '$218.9M' },
        { amount: '1,120 BTC', detail: 'Unknown → Binance', time: '1.5 hours ago', usd: '$76.6M' },
    ];

    function initWhaleFeed() {
        const container = $('#whaleFeed');
        container.innerHTML = whaleAlerts.map((w, i) =>
            `<div class="whale-item" style="animation-delay:${i * 0.1}s">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="whale-amount">${w.amount}</span>
                    <span class="whale-amount" style="font-size:11px;color:var(--text-secondary)">${w.usd}</span>
                </div>
                <span class="whale-detail">${w.detail}</span>
                <span class="whale-time">${w.time}</span>
            </div>`
        ).join('');
    }

    // ─── NEWS CARDS ───
    const newsData = [
        {
            source: 'CoinDesk',
            headline: 'Bitcoin Surges Past $68K as Institutional Inflows Hit Record Highs',
            sentiment: 'bullish',
            time: '2 hours ago',
            image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=600&auto=format&fit=crop',
        },
        {
            source: 'Bloomberg',
            headline: 'Federal Reserve Signals Potential Rate Cuts, Crypto Market Responds',
            sentiment: 'bullish',
            time: '4 hours ago',
            image: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?q=80&w=600&auto=format&fit=crop',
        },
        {
            source: 'Reuters',
            headline: 'Major Bank Launches Bitcoin Custody Service for Institutional Clients',
            sentiment: 'bullish',
            time: '6 hours ago',
            image: 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?q=80&w=600&auto=format&fit=crop',
        },
        {
            source: 'CryptoSlate',
            headline: 'Bitcoin Mining Difficulty Hits All-Time High After Halving Event',
            sentiment: 'neutral',
            time: '8 hours ago',
            image: 'https://images.unsplash.com/photo-1622630998477-20b41cd0e073?q=80&w=600&auto=format&fit=crop',
        },
        {
            source: 'The Block',
            headline: 'SEC Commissioner Calls for "Rational" Crypto Regulation Framework',
            sentiment: 'neutral',
            time: '10 hours ago',
            image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=600&auto=format&fit=crop',
        },
        {
            source: 'Decrypt',
            headline: 'Whale Activity Spikes as $342M in BTC Moves to Cold Storage',
            sentiment: 'bearish',
            time: '12 hours ago',
            image: 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=600&auto=format&fit=crop',
        },
    ];

    function initNews() {
        const container = $('#newsGrid');
        container.innerHTML = newsData.map((n, i) =>
            `<article class="news-card" style="animation: fadeSlideUp 0.5s ease-out ${i * 0.1}s both" role="article">
                <div class="news-thumb" style="background: url('${n.image}') center/cover no-repeat;"></div>
                <div class="news-body">
                    <div class="news-meta">
                        <span class="news-source">${n.source}</span>
                        <span class="news-sentiment-tag ${n.sentiment}">${n.sentiment}</span>
                    </div>
                    <h3 class="news-headline">${n.headline}</h3>
                    <span class="news-time">${n.time}</span>
                </div>
            </article>`
        ).join('');
    }

    // ─── PORTFOLIO ───
    const portfolioData = [
        { icon: '₿', name: 'Bitcoin', sym: 'BTC', holdings: '1.284', avg: '$54,200', current: '$68,432', pnl: '+$18,265', pnlPct: '+26.3%', color: '#F7931A', positive: true },
        { icon: 'Ξ', name: 'Ethereum', sym: 'ETH', holdings: '12.5', avg: '$2,800', current: '$3,821', pnl: '+$12,762', pnlPct: '+36.5%', color: '#627EEA', positive: true },
        { icon: '◎', name: 'Solana', sym: 'SOL', holdings: '85', avg: '$142', current: '$178.92', pnl: '+$3,138', pnlPct: '+26.0%', color: '#9945FF', positive: true },
        { icon: '⬡', name: 'Chainlink', sym: 'LINK', holdings: '450', avg: '$17.50', current: '$15.23', pnl: '-$1,021', pnlPct: '-13.0%', color: '#2A5ADA', positive: false },
        { icon: '●', name: 'Polkadot', sym: 'DOT', holdings: '320', avg: '$8.90', current: '$7.84', pnl: '-$339', pnlPct: '-11.9%', color: '#E6007A', positive: false },
    ];

    function initPortfolio() {
        // Table
        const tbody = $('#portfolioBody');
        tbody.innerHTML = portfolioData.map(p =>
            `<tr>
                <td>
                    <div class="asset-cell">
                        <div class="asset-icon" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}44">${p.icon}</div>
                        <div>
                            <div class="asset-name">${p.name}</div>
                            <div class="asset-sym">${p.sym}</div>
                        </div>
                    </div>
                </td>
                <td>${p.holdings} ${p.sym}</td>
                <td>${p.avg}</td>
                <td>${p.current}</td>
                <td class="${p.positive ? 'pnl-positive' : 'pnl-negative'}">${p.pnl} (${p.pnlPct})</td>
            </tr>`
        ).join('');

        // Donut chart
        drawDonut();

        // Legend
        const legend = $('#donutLegend');
        const allocs = [
            { name: 'Bitcoin', pct: 52, color: '#F7931A' },
            { name: 'Ethereum', pct: 28, color: '#627EEA' },
            { name: 'Solana', pct: 9, color: '#9945FF' },
            { name: 'Chainlink', pct: 6, color: '#2A5ADA' },
            { name: 'Polkadot', pct: 5, color: '#E6007A' },
        ];
        legend.innerHTML = allocs.map(a =>
            `<div class="legend-item">
                <span class="legend-dot" style="background:${a.color}"></span>
                <span>${a.name}</span>
                <span class="legend-pct">${a.pct}%</span>
            </div>`
        ).join('');
    }

    function drawDonut() {
        const canvas = $('#donutChart');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = 220;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const cx = size / 2, cy = size / 2, r = 85, lineW = 22;
        const segments = [
            { pct: 52, color: '#F7931A' },
            { pct: 28, color: '#627EEA' },
            { pct: 9, color: '#9945FF' },
            { pct: 6, color: '#2A5ADA' },
            { pct: 5, color: '#E6007A' },
        ];

        let startAngle = -Math.PI / 2;
        segments.forEach(seg => {
            const sliceAngle = (seg.pct / 100) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = lineW;
            ctx.lineCap = 'butt';
            ctx.shadowColor = seg.color + '55';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
            startAngle += sliceAngle + 0.03; // small gap
        });

        // Center text
        ctx.font = '700 24px Orbitron';
        ctx.fillStyle = '#F1F5F9';
        ctx.textAlign = 'center';
        ctx.fillText('$121.4K', cx, cy + 3);
        ctx.font = '400 11px Inter';
        ctx.fillStyle = '#64748B';
        ctx.fillText('Total Value', cx, cy + 22);
    }

    // ─── MOBILE MENU ───
    function initMobileMenu() {
        const btn = $('#mobileMenuBtn');
        const links = $('#navLinks');
        btn.addEventListener('click', () => {
            links.classList.toggle('open');
            btn.setAttribute('aria-expanded', links.classList.contains('open'));
        });
    }

    // ─── TIMEFRAME BUTTONS ───
    function initTimeframes() {
        const btns = $$('.tf-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Redraw chart with new data
                const candles = generateCandleData(randInt(30, 60));
                drawCandlestick($('#priceChart'), candles);
                drawVolume($('#volumeChart'), candles);
            });
        });
    }

    // ─── SMOOTH SCROLL NAV ACTIVE ───
    function initNavHighlight() {
        const sections = $$('section[id], .hero');
        const navLinks = $$('.nav-link');
        const mbItems = $$('.mb-nav-item');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    navLinks.forEach(l => {
                        l.classList.toggle('active', l.getAttribute('href') === '#' + id);
                    });
                    mbItems.forEach(l => {
                        l.classList.toggle('active', l.getAttribute('href') === '#' + id);
                    });
                }
            });
        }, { rootMargin: '-30% 0px -60% 0px' });

        sections.forEach(s => observer.observe(s));
    }

    // ─── GAUGE POSITION (value 0-100) ───
    function setGaugeValue(value) {
        // Arc goes from roughly x=20 to x=180 along the semicircle
        // angle from -180 deg to 0 deg
        const angle = -Math.PI + (value / 100) * Math.PI;
        const cx = 100, cy = 100, r = 80;
        const nx = cx + r * Math.cos(angle);
        const ny = cy + r * Math.sin(angle);

        // Set needle position
        const needles = $$('.gauge-needle');
        needles.forEach(n => {
            n.setAttribute('cx', nx);
            n.setAttribute('cy', ny);
        });

        // Set fill dash
        const totalLen = 251; // approx arc length
        const offset = totalLen * (1 - value / 100);
        const fills = $$('.gauge-fill');
        fills.forEach(f => {
            f.style.strokeDashoffset = offset;
        });
    }

    // ─── COUNTER ANIMATION ───
    function animateCounter(el, target, prefix = '', suffix = '') {
        const duration = 1500;
        const start = performance.now();
        const startVal = 0;

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = startVal + (target - startVal) * eased;
            el.textContent = prefix + fmt(current, target % 1 !== 0 ? 2 : 0) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // ─── NAVBAR SCROLL EFFECT ───
    function initNavScroll() {
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const nav = $('#navbar');
                    if (window.scrollY > 100) {
                        nav.style.boxShadow = '0 4px 30px rgba(0,0,0,0.5)';
                    } else {
                        nav.style.boxShadow = 'none';
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // ─── SIMULATED LIVE PRICE UPDATES ───
    function initLivePrices() {
        setInterval(() => {
            const basePrice = 68432.17;
            const fluctuation = rand(-200, 200);
            const newPrice = basePrice + fluctuation;
            const changePct = ((newPrice - basePrice) / basePrice * 100 + 2.34);
            const isUp = changePct >= 0;

            const priceStr = '$' + fmt(newPrice);
            const changeStr = (isUp ? '+' : '') + fmt(changePct) + '% ' + (isUp ? '↑' : '↓');

            const navPrice = $('#navBtcPrice');
            const heroPrice = $('#heroBtcPrice');
            const heroChange = $('#heroBtcChange');

            if (navPrice) navPrice.textContent = priceStr;
            if (heroPrice) {
                heroPrice.textContent = priceStr;
                heroPrice.classList.add('counter-animate');
                setTimeout(() => heroPrice.classList.remove('counter-animate'), 600);
            }
            if (heroChange) {
                heroChange.textContent = changeStr;
                heroChange.className = 'hero-change ' + (isUp ? 'positive' : 'negative');
            }
        }, 4000);
    }

    // ─── INTERSECTION OBSERVER FOR ANIMATIONS ───
    function initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        $$('.glass-card, .price-card, .news-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // ─── RESIZE HANDLER ───
    function initResize() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                // Redraw charts
                const candles = generateCandleData(45);
                drawCandlestick($('#priceChart'), candles);
                drawVolume($('#volumeChart'), candles);
                drawPrediction($('#predictionChart'));
                drawFlowChart($('#flowChart'));
                drawDonut();
                // Redraw sparklines
                marketData.forEach((m, idx) => {
                    const canvas = $(`#spark${idx}`);
                    if (canvas) drawSparkline(canvas, generateSparkData(m.up), m.up ? '#22C55E' : '#EF4444');
                });
            }, 250);
        });
    }

    // ─── CONNECT WALLET BUTTON ───
    function initWalletBtn() {
        const btn = $('#connectWallet');
        btn.addEventListener('click', () => {
            btn.textContent = '⬡ Connecting...';
            btn.style.opacity = '0.7';
            setTimeout(() => {
                btn.innerHTML = '<span class="wallet-icon">✓</span> Connected';
                btn.style.opacity = '1';
                btn.style.background = 'linear-gradient(135deg, #22C55E, #06B6D4)';
                btn.style.boxShadow = '0 0 20px rgba(34,197,94,0.4), 0 0 40px rgba(34,197,94,0.15)';
            }, 1500);
        });
    }

    // ─── INIT ALL ───
    function init() {
        initRain();
        initCoins();
        initTicker();
        initMarketCards();
        initMobileMenu();
        initTimeframes();
        initNavHighlight();
        initNavScroll();
        initWalletBtn();

        // Draw charts
        const candles = generateCandleData(45);
        drawCandlestick($('#priceChart'), candles);
        drawVolume($('#volumeChart'), candles);
        drawPrediction($('#predictionChart'));
        drawFlowChart($('#flowChart'));

        // Set gauge
        setGaugeValue(72);

        // Whale feed
        initWhaleFeed();

        // News
        initNews();

        // Portfolio
        initPortfolio();

        // Live price simulation
        initLivePrices();

        // Scroll animations (delay to allow initial render)
        setTimeout(initScrollAnimations, 100);

        // Resize
        initResize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
