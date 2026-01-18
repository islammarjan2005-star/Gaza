import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

const redis = new Redis(config.redisUrl, {
  password: config.redisPassword || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Cache utilities
export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheIncrement(key: string): Promise<number> {
  return redis.incr(key);
}

export async function healthCheck(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}

export { redis };
