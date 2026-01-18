import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Privacy middleware - anonymizes and protects user data
 */
export function privacyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Anonymize IP address for logging
  const originalIp = req.ip || '';
  const anonymizedIp = anonymizeIp(originalIp);

  // Store original for rate limiting, anonymized for logging
  (req as any).anonymizedIp = anonymizedIp;

  // Remove tracking headers that could identify users
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];

  // Set privacy headers in response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Disable caching for sensitive endpoints
  if (req.path.includes('/admin') || req.path.includes('/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Anonymize IP address (keep first two octets for geo-location, zero out rest)
 */
function anonymizeIp(ip: string): string {
  if (!ip) return '0.0.0.0';

  // Handle IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.0.0`;
    }
  }

  // Handle IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}::`;
    }
  }

  return '0.0.0.0';
}

/**
 * Hash sensitive data for storage
 */
export function hashSensitiveData(data: string, salt?: string): string {
  const actualSalt = salt || process.env.HASH_SALT || 'ecosia-gaza-default-salt';
  return crypto
    .createHmac('sha256', actualSalt)
    .update(data)
    .digest('hex');
}

/**
 * Generate anonymous session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GDPR/CCPA consent check middleware
 */
export function requireConsent(req: Request, res: Response, next: NextFunction): void {
  const consentHeader = req.headers['x-privacy-consent'];

  if (!consentHeader) {
    // Allow basic functionality without explicit consent
    // Only analytics/tracking require consent
    (req as any).hasConsent = false;
    next();
    return;
  }

  try {
    const consent = JSON.parse(Buffer.from(consentHeader as string, 'base64').toString());
    (req as any).consent = {
      analytics: consent.analytics === true,
      marketing: consent.marketing === true,
      timestamp: consent.timestamp,
    };
    (req as any).hasConsent = true;
  } catch {
    (req as any).hasConsent = false;
  }

  next();
}

/**
 * Data retention enforcement
 * Called by scheduled job to purge old data
 */
export async function enforceDataRetention(
  tableName: string,
  dateColumn: string,
  retentionDays: number
): Promise<number> {
  const { query } = await import('../config/database');

  const sql = `
    DELETE FROM ${tableName}
    WHERE ${dateColumn} < NOW() - INTERVAL '${retentionDays} days'
  `;

  try {
    const { rowCount } = await query(sql);
    logger.info('Data retention enforced', {
      table: tableName,
      deleted: rowCount,
      retentionDays,
    });
    return rowCount;
  } catch (error) {
    logger.error('Data retention failed', {
      table: tableName,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Export user data (for GDPR data portability)
 */
export async function exportUserData(sessionToken: string): Promise<object> {
  const { query } = await import('../config/database');

  // Hash the session token for lookup
  const tokenHash = hashSensitiveData(sessionToken);

  const searchesSql = `
    SELECT
      query_hash,
      query_category,
      result_count,
      ad_count,
      device_type,
      country_code,
      created_at
    FROM search_sessions
    WHERE session_token = $1
    ORDER BY created_at DESC
    LIMIT 1000
  `;

  const { rows: searches } = await query(searchesSql, [sessionToken]);

  return {
    exportDate: new Date().toISOString(),
    sessionToken: tokenHash.substring(0, 10) + '...',
    searches: searches.map((s: any) => ({
      queryHash: s.query_hash.substring(0, 10) + '...',
      category: s.query_category,
      resultCount: s.result_count,
      adCount: s.ad_count,
      deviceType: s.device_type,
      country: s.country_code,
      date: s.created_at,
    })),
    note: 'This export contains anonymized data. Original search queries are not stored.',
  };
}

/**
 * Delete user data (for GDPR right to erasure)
 */
export async function deleteUserData(sessionToken: string): Promise<{
  deleted: boolean;
  affectedRows: number;
}> {
  const { transaction } = await import('../config/database');

  try {
    const result = await transaction(async (client) => {
      // Get session IDs
      const { rows } = await client.query(
        'SELECT id FROM search_sessions WHERE session_token = $1',
        [sessionToken]
      );

      const sessionIds = rows.map((r: any) => r.id);

      if (sessionIds.length === 0) {
        return { deleted: true, affectedRows: 0 };
      }

      // Delete in order due to foreign keys
      await client.query(
        'DELETE FROM ad_clicks WHERE session_id = ANY($1)',
        [sessionIds]
      );

      await client.query(
        'DELETE FROM ad_impressions WHERE session_id = ANY($1)',
        [sessionIds]
      );

      const { rowCount } = await client.query(
        'DELETE FROM search_sessions WHERE session_token = $1',
        [sessionToken]
      );

      return { deleted: true, affectedRows: rowCount || 0 };
    });

    logger.info('User data deleted', {
      sessionToken: hashSensitiveData(sessionToken).substring(0, 10),
      affectedRows: result.affectedRows,
    });

    return result;
  } catch (error) {
    logger.error('User data deletion failed', { error: (error as Error).message });
    throw error;
  }
}
