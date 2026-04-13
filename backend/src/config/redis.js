import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Redis client
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        // Retry connection after a delay
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    // Required for Render Redis or other TLS-enabled Redis instances
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis');
});

redis.on('error', (err) => {
    // console.error('Redis Connection Error Details:', err);
    // if (err.code) console.error('Error Code:', err.code);
});

export default redis;
