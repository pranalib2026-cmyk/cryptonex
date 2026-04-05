// ═══════════════════════════════════════════════════════════
// Unit Tests — Analysis Engine Modules
// Run: node tests/analysis.test.js
// ═══════════════════════════════════════════════════════════

const { analyzeMarket, computeRSI, computeMACD, computeBollingerBands, computeEMA, computeATR, computeVolumeTrend, computeSupportResistance } = require('../services/technicalAnalysis');
const { predictTrend, linearRegression, holtWinters, standardDeviation, computeRSquared } = require('../services/trendPrediction');
const { classifyMarket } = require('../services/marketClassifier');
const { mapFearGreedLabel } = require('../services/smartScore');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName) {
    total++;
    if (condition) {
        passed++;
        console.log(`  ✔ ${testName}`);
    } else {
        failed++;
        console.error(`  ✘ FAIL: ${testName}`);
    }
}

function assertApprox(actual, expected, tolerance, testName) {
    total++;
    if (actual != null && Math.abs(actual - expected) <= tolerance) {
        passed++;
        console.log(`  ✔ ${testName} (${actual} ≈ ${expected})`);
    } else {
        failed++;
        console.error(`  ✘ FAIL: ${testName} (got ${actual}, expected ≈${expected} ±${tolerance})`);
    }
}

// ═══════════════════ Test Data ═══════════════════════════

function generateCandles(count, startPrice = 65000, trend = 0.001) {
    const candles = [];
    let price = startPrice;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const noise = (Math.random() - 0.5) * price * 0.03;
        price = price * (1 + trend) + noise;
        const high = price * (1 + Math.random() * 0.015);
        const low = price * (1 - Math.random() * 0.015);
        const open = price + (Math.random() - 0.5) * price * 0.01;
        const volume = 1000 + Math.random() * 5000;

        candles.push({
            timestamp: new Date(now - (count - i) * 86400000),
            open, high, low, close: price, volume,
        });
    }
    return candles;
}

const bullishCandles = generateCandles(100, 60000, 0.005);   // uptrend
const bearishCandles = generateCandles(100, 70000, -0.005);  // downtrend
const sidewaysCandles = generateCandles(100, 65000, 0.0001); // sideways
const shortCandles = generateCandles(10);                     // too few

// ═══════════════════ Technical Analysis Tests ════════════

console.log('\n═══ Technical Analysis Module ═══');

// RSI
console.log('\n--- RSI ---');
const rsi = computeRSI(bullishCandles.map(c => c.close), 14);
assert(rsi.value !== null, 'RSI returns a value');
assert(rsi.value >= 0 && rsi.value <= 100, `RSI in range 0-100 (got ${rsi.value?.toFixed(1)})`);

const rsiShort = computeRSI([100, 105, 103], 14);
assert(rsiShort.value === null, 'RSI returns null for insufficient data');

// MACD
console.log('\n--- MACD ---');
const macd = computeMACD(bullishCandles.map(c => c.close));
assert(macd.MACD !== undefined, 'MACD returns value');
assert(typeof macd.histogram === 'number', 'MACD histogram is a number');
assert(typeof macd.prevHistogram === 'number', 'MACD has previous histogram');

// Bollinger Bands
console.log('\n--- Bollinger Bands ---');
const bb = computeBollingerBands(bullishCandles.map(c => c.close), 20, 2);
assert(bb !== null, 'Bollinger Bands returns result');
assert(bb.upper > bb.middle, 'Upper band > middle');
assert(bb.middle > bb.lower, 'Middle > lower band');
assert(bb.upper - bb.lower > 0, 'Band width is positive');

// EMA
console.log('\n--- EMA ---');
const ema50 = computeEMA(bullishCandles.map(c => c.close), 50);
assert(ema50 !== null, 'EMA50 returns a value for 100 candles');
assert(typeof ema50 === 'number', 'EMA50 is a number');

const ema200Short = computeEMA(bullishCandles.map(c => c.close).slice(0, 50), 200);
assert(ema200Short === null, 'EMA200 returns null for 50 candles');

// ATR
console.log('\n--- ATR ---');
const atr = computeATR(
    bullishCandles.map(c => c.high),
    bullishCandles.map(c => c.low),
    bullishCandles.map(c => c.close), 14
);
assert(atr !== null, 'ATR returns a value');
assert(atr > 0, 'ATR is positive');

// Volume Trend
console.log('\n--- Volume Trend ---');
const vt = computeVolumeTrend(bullishCandles.map(c => c.volume));
assert(['increasing', 'decreasing', 'stable'].includes(vt.trend), `Volume trend is valid (${vt.trend})`);
assert(typeof vt.ratio === 'number', 'Volume ratio is a number');

// Support/Resistance
console.log('\n--- Support & Resistance ---');
const sr = computeSupportResistance(
    bullishCandles.map(c => c.high),
    bullishCandles.map(c => c.low),
    bullishCandles.map(c => c.close)
);
assert(sr.support > 0, 'Support level is positive');
assert(sr.resistance > 0, 'Resistance level is positive');
assert(sr.resistance >= sr.support, 'Resistance >= Support');

// Full Analysis
console.log('\n--- Full Market Analysis ---');
const bullAnalysis = analyzeMarket(bullishCandles);
assert(bullAnalysis.signal !== undefined, 'Analysis returns signal');
assert(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(bullAnalysis.signal), `Signal is valid enum (${bullAnalysis.signal})`);
assert(bullAnalysis.confidence >= 0 && bullAnalysis.confidence <= 100, `Confidence 0-100 (${bullAnalysis.confidence})`);
assert(Array.isArray(bullAnalysis.reasons), 'Reasons is an array');
assert(bullAnalysis.reasons.length > 0, 'At least one reason provided');
assert(bullAnalysis.support > 0, 'Support level calculated');
assert(bullAnalysis.resistance > 0, 'Resistance level calculated');
assert(bullAnalysis.stopLoss > 0, 'Stop loss calculated');
assert(bullAnalysis.indicators.rsi !== undefined, 'RSI in indicators');
assert(bullAnalysis.indicators.macd !== undefined, 'MACD in indicators');

const insufficientAnalysis = analyzeMarket(shortCandles);
assert(insufficientAnalysis.signal === 'NEUTRAL', 'Short data returns NEUTRAL');
assert(insufficientAnalysis.confidence === 0, 'Short data confidence is 0');

// ═══════════════════ Trend Prediction Tests ══════════════

console.log('\n═══ Trend Prediction Module ═══');

// Linear Regression
console.log('\n--- Linear Regression ---');
const linReg = linearRegression([1, 2, 3, 4, 5]);
assertApprox(linReg.slope, 1, 0.01, 'Linear regression slope for [1,2,3,4,5]');

const linRegFlat = linearRegression([5, 5, 5, 5, 5]);
assertApprox(linRegFlat.slope, 0, 0.01, 'Zero slope for flat series');

const linRegDown = linearRegression([10, 8, 6, 4, 2]);
assert(linRegDown.slope < 0, 'Negative slope for descending series');

// Holt-Winters
console.log('\n--- Holt-Winters ---');
const hw = holtWinters([100, 105, 110, 115, 120], 0.3, 0.1);
assert(hw.level > 0, 'Holt-Winters level is positive');
assert(hw.trend > 0, 'Positive trend for ascending series');

const hwFlat = holtWinters([50, 50, 50, 50, 50], 0.3, 0.1);
assertApprox(hwFlat.trend, 0, 1, 'Near-zero trend for flat series');

// Standard Deviation
console.log('\n--- Standard Deviation ---');
const sd = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
assertApprox(sd, 2, 0.2, 'StdDev of [2,4,4,4,5,5,7,9]');

const sdZero = standardDeviation([5, 5, 5, 5]);
assertApprox(sdZero, 0, 0.01, 'Zero StdDev for identical values');

// R-Squared
console.log('\n--- R-Squared ---');
const perfectReg = linearRegression([2, 4, 6, 8, 10]);
const r2Perfect = computeRSquared([2, 4, 6, 8, 10], perfectReg);
assertApprox(r2Perfect, 1.0, 0.01, 'R² = 1.0 for perfect linear fit');

// Full Prediction
console.log('\n--- Full Prediction ---');
const prediction = predictTrend(bullishCandles);
assert(Array.isArray(prediction.predictions), 'Predictions is an array');
assert(prediction.predictions.length === 7, '7-day forecast');
assert(prediction.predictions[0].predicted > 0, 'Day 1 prediction is positive');
assert(prediction.predictions[0].upper > prediction.predictions[0].predicted, 'Upper bound > predicted');
assert(prediction.predictions[0].lower < prediction.predictions[0].predicted, 'Lower bound < predicted');
assert(prediction.predictions[0].date !== undefined, 'Prediction has date');
assert(prediction.trend.direction !== undefined, 'Has trend direction');
assert(prediction.trend.rSquared >= 0 && prediction.trend.rSquared <= 1, 'R² in [0,1]');
assert(prediction.disclaimer.includes('Not Financial Advice'), 'Includes disclaimer');

const shortPred = predictTrend(shortCandles);
assert(shortPred.predictions.length === 0, 'Short data returns empty predictions');

// ═══════════════════ Market Classifier Tests ═════════════

console.log('\n═══ Market Classifier Module ═══');

const bullClassification = classifyMarket(bullishCandles);
assert(bullClassification.phase !== undefined, 'Classification has phase');
assert(bullClassification.label !== undefined, 'Classification has label');
assert(bullClassification.explanation.length > 20, 'Explanation is detailed');
assert(Array.isArray(bullClassification.characteristics), 'Has characteristics array');

const shortClassification = classifyMarket(shortCandles);
assert(shortClassification.phase === 'unknown', 'Short data returns unknown phase');

// ═══════════════════ Smart Score Tests ═══════════════════

console.log('\n═══ Smart Score Module ═══');

assert(mapFearGreedLabel(10) === 'Extreme Fear', 'F&G 10 = Extreme Fear');
assert(mapFearGreedLabel(25) === 'Extreme Fear', 'F&G 25 = Extreme Fear');
assert(mapFearGreedLabel(26) === 'Fear', 'F&G 26 = Fear');
assert(mapFearGreedLabel(45) === 'Fear', 'F&G 45 = Fear');
assert(mapFearGreedLabel(50) === 'Neutral', 'F&G 50 = Neutral');
assert(mapFearGreedLabel(65) === 'Greed', 'F&G 65 = Greed');
assert(mapFearGreedLabel(80) === 'Extreme Greed', 'F&G 80 = Extreme Greed');

// ═══════════════════ Results ═════════════════════════════

console.log('\n═══════════════════════════════════════');
console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log(`  ${failed === 0 ? '✔ ALL TESTS PASSED' : '✘ SOME TESTS FAILED'}`);
console.log('═══════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
