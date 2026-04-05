// ═══════════════════════════════════════════════════════════
// CryptoNex Backend — MongoDB Connection via Mongoose
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

let isConnected = false;

async function connectDatabase() {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cryptonex';

    mongoose.set('strictQuery', false);

    mongoose.connection.on('connected', () => {
        isConnected = true;
        console.log('  ✔ MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
        console.error('  ✘ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
        isConnected = false;
        console.log('  ⚠ MongoDB disconnected');
    });

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
        });
    } catch (err) {
        console.error('  ✘ MongoDB initial connection failed:', err.message);
        console.log('  ℹ Server will continue without database — data will not be persisted');
    }
}

function isDatabaseConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, isDatabaseConnected };
