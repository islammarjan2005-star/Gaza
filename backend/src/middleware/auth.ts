import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { query } from '../config/database';
import { logger } from '../utils/logger';

interface AdminPayload {
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
      apiKey?: { name: string; permissions: string[] };
    }
  }
}

/**
 * Verify admin JWT token
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AdminPayload;

    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.admin = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid admin token', { error: (error as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Verify API key for partner access
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const sql = `
      SELECT name, permissions, is_active, expires_at
      FROM api_keys
      WHERE key_hash = $1
    `;

    const { rows } = await query<{
      name: string;
      permissions: string[];
      is_active: boolean;
      expires_at: Date | null;
    }>(sql, [keyHash]);

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const key = rows[0];

    if (!key.is_active) {
      res.status(403).json({ error: 'API key is disabled' });
      return;
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      res.status(403).json({ error: 'API key has expired' });
      return;
    }

    // Update last used timestamp
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1',
      [keyHash]
    );

    req.apiKey = {
      name: key.name,
      permissions: key.permissions,
    };

    next();
  } catch (error) {
    logger.error('API key verification failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Check specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin) {
      // Admins have all permissions
      next();
      return;
    }

    if (req.apiKey && req.apiKey.permissions.includes(permission)) {
      next();
      return;
    }

    res.status(403).json({ error: `Permission '${permission}' required` });
  };
}

/**
 * Generate admin JWT token
 */
export function generateAdminToken(email: string, role: string = 'admin'): string {
  return jwt.sign({ email, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Generate API key
 */
export async function generateApiKey(
  name: string,
  permissions: string[] = [],
  expiresInDays?: number
): Promise<{ key: string; prefix: string }> {
  const key = crypto.randomBytes(32).toString('hex');
  const prefix = key.substring(0, 10);
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const sql = `
    INSERT INTO api_keys (key_hash, key_prefix, name, permissions, expires_at)
    VALUES ($1, $2, $3, $4, $5)
  `;

  await query(sql, [keyHash, prefix, name, JSON.stringify(permissions), expiresAt]);

  return { key, prefix };
}
