// ═══════════════════════════════════════════════════════════
// Scheduler — Re-runs analysis every 4 hours
// Uses setInterval (no external cron dependency needed)
// ═══════════════════════════════════════════════════════════

const { runAnalysis } = require('../services/analysisEngine');

const FOUR_HOURS = 4 * 60 * 60 * 1000; // 14,400,000 ms
let schedulerInterval = null;
let lastRun = null;
let runCount = 0;

/**
 * Start the analysis scheduler
 * Runs immediately on first call, then every 4 hours
 */
function startScheduler() {
    console.log('  ✔ Analysis scheduler started (every 4 hours)');

    // Run initial analysis after 10-second warm-up
    setTimeout(async () => {
        await executeScheduledAnalysis();
    }, 10000);

    // Schedule recurring runs
    schedulerInterval = setInterval(async () => {
        await executeScheduledAnalysis();
    }, FOUR_HOURS);
}

async function executeScheduledAnalysis() {
    const startTime = Date.now();
    runCount++;

    console.log(`\n  ⏰ Scheduled analysis run #${runCount} starting...`);

    try {
        // Run analysis for BTC with 90-day window
        const result = await runAnalysis('BTCUSDT', '90d');

        lastRun = {
            timestamp: new Date().toISOString(),
            success: result.success,
            signal: result.technicalAnalysis?.signal,
            smartScore: result.smartScore?.score,
            marketPhase: result.marketCondition?.phase,
            elapsed: `${Date.now() - startTime}ms`,
            runNumber: runCount,
        };

        console.log(`  ✔ Scheduled analysis #${runCount} complete:`, {
            signal: lastRun.signal,
            smartScore: lastRun.smartScore,
            phase: lastRun.marketPhase,
            time: lastRun.elapsed,
        });
    } catch (err) {
        console.error(`  ✘ Scheduled analysis #${runCount} failed:`, err.message);
        lastRun = {
            timestamp: new Date().toISOString(),
            success: false,
            error: err.message,
            runNumber: runCount,
        };
    }
}

function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('  ⚠ Analysis scheduler stopped');
    }
}

function getSchedulerStatus() {
    return {
        running: schedulerInterval !== null,
        intervalMs: FOUR_HOURS,
        intervalHuman: '4 hours',
        totalRuns: runCount,
        lastRun,
        nextRun: lastRun
            ? new Date(new Date(lastRun.timestamp).getTime() + FOUR_HOURS).toISOString()
            : null,
    };
}

module.exports = { startScheduler, stopScheduler, getSchedulerStatus };
