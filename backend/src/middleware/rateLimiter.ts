import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Standard rate limiter for API requests
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use session token if available, otherwise IP
    return (req.headers['x-session-token'] as string) || req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready';
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      sessionToken: req.headers['x-session-token'],
    });

    res.status(429).json({
      error: 'Too many requests, please try again later',
      retryAfter: Math.ceil(config.rateLimitWindowMs / 1000),
    });
  },
});

/**
 * Stricter rate limiter for search requests
 */
export const searchLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    error: 'Search rate limit exceeded',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `search:${(req.headers['x-session-token'] as string) || req.ip || 'unknown'}`;
  },
});

/**
 * Limiter for ad click requests (prevent click fraud)
 */
export const clickLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 clicks per minute
  message: {
    error: 'Click rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `click:${(req.headers['x-session-token'] as string) || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    logger.warn('Click rate limit exceeded - possible fraud', {
      ip: req.ip,
      sessionToken: req.headers['x-session-token'],
    });

    res.status(429).json({
      error: 'Too many clicks',
    });
  },
});

/**
 * Admin endpoint rate limiter
 */
export const adminLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: {
    error: 'Admin rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Custom Redis-based rate limiter for distributed deployments
 */
export async function distributedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

  try {
    const current = await redis.incr(windowKey);

    if (current === 1) {
      await redis.expire(windowKey, windowSeconds);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = Math.ceil(now / (windowSeconds * 1000)) * windowSeconds * 1000;

    return { allowed, remaining, resetAt };
  } catch (error) {
    logger.error('Rate limit check failed', { error: (error as Error).message });
    // Fail open - allow request if Redis is down
    return { allowed: true, remaining: limit, resetAt: 0 };
  }
}
