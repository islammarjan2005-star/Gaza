import { Pool, PoolClient } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      text: text.substring(0, 100),
      duration,
      rows: result.rowCount,
    });

    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (error) {
    logger.error('Database query failed', {
      text: text.substring(0, 100),
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export { pool };
