const Redis = require('ioredis');
const logger = require('./logger');

let redis = null;

function getRedis() {
  if (redis) return redis;
  if (!process.env.REDIS_URL) return null;

  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 3 ? null : 200),
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    logger.warn(`Redis connection issue (caching disabled temporarily): ${err.message}`);
  });

  redis.connect().catch(() => {
    logger.warn('تعذّر الاتصال بـ Redis — سيستمر النظام بالعمل بدون تخزين مؤقت.');
  });

  return redis;
}

// عمليات مساعدة آمنة (لا تُسقط الطلب لو Redis غير متاح)
async function cacheGet(key) {
  try {
    const client = getRedis();
    if (!client || client.status !== 'ready') return null;
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    logger.warn(`cacheGet failed: ${err.message}`);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 60) {
  try {
    const client = getRedis();
    if (!client || client.status !== 'ready') return;
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`cacheSet failed: ${err.message}`);
  }
}

async function cacheDel(pattern) {
  try {
    const client = getRedis();
    if (!client || client.status !== 'ready') return;
    await client.del(pattern);
  } catch (err) {
    logger.warn(`cacheDel failed: ${err.message}`);
  }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheDel };
