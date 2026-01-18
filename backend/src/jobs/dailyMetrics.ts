import cron from 'node-cron';
import { query, transaction } from '../config/database';
import { cacheGet, cacheSet, cacheDelete } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Calculate and store daily metrics
 * Aggregates search, impression, and click data for a given date
 */
export async function calculateDailyMetrics(targetDate?: Date): Promise<void> {
  const jobName = 'daily-metrics';
  const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to yesterday
  date.setHours(0, 0, 0, 0);

  const dateStr = date.toISOString().split('T')[0];
  logger.info(`Starting job: ${jobName}`, { date: dateStr });

  try {
    // Get cached counters from Redis
    const cachedSearches = await cacheGet<number>(`metrics:searches:${dateStr}`) || 0;
    const cachedClicks = await cacheGet<number>(`metrics:clicks:${dateStr}`) || 0;
    const cachedImpressions = await cacheGet<number>(`metrics:impressions:${dateStr}`) || 0;

    // Calculate metrics from database
    const sql = `
      WITH session_stats AS (
        SELECT
          COUNT(*) as total_searches,
          COUNT(DISTINCT session_token) as unique_devices,
          AVG(response_time_ms)::INTEGER as avg_response_time,
          jsonb_object_agg(
            COALESCE(query_category, 'other'),
            category_count
          ) as top_categories,
          jsonb_object_agg(
            COALESCE(country_code, 'XX'),
            country_count
          ) as country_breakdown
        FROM search_sessions ss
        LEFT JOIN LATERAL (
          SELECT query_category, COUNT(*) as category_count
          FROM search_sessions
          WHERE DATE(created_at) = $1
          GROUP BY query_category
          ORDER BY category_count DESC
          LIMIT 10
        ) cats ON true
        LEFT JOIN LATERAL (
          SELECT country_code, COUNT(*) as country_count
          FROM search_sessions
          WHERE DATE(created_at) = $1
          GROUP BY country_code
          ORDER BY country_count DESC
          LIMIT 20
        ) countries ON true
        WHERE DATE(ss.created_at) = $1
      ),
      impression_stats AS (
        SELECT COUNT(*) as total_impressions
        FROM ad_impressions
        WHERE DATE(impression_timestamp) = $1
      ),
      click_stats AS (
        SELECT
          COUNT(*) as total_clicks,
          COALESCE(SUM(estimated_cpc), 0) as estimated_revenue
        FROM ad_clicks
        WHERE DATE(click_timestamp) = $1
      )
      SELECT
        COALESCE(ss.total_searches, 0) as total_searches,
        COALESCE(ss.unique_devices, 0) as unique_devices,
        COALESCE(ss.avg_response_time, 0) as avg_response_time,
        COALESCE(ss.top_categories, '{}'::jsonb) as top_categories,
        COALESCE(ss.country_breakdown, '{}'::jsonb) as country_breakdown,
        COALESCE(is.total_impressions, 0) as total_impressions,
        COALESCE(cs.total_clicks, 0) as total_clicks,
        COALESCE(cs.estimated_revenue, 0) as estimated_revenue
      FROM session_stats ss
      CROSS JOIN impression_stats is
      CROSS JOIN click_stats cs
    `;

    const { rows } = await query<{
      total_searches: string;
      unique_devices: string;
      avg_response_time: string;
      top_categories: Record<string, number>;
      country_breakdown: Record<string, number>;
      total_impressions: string;
      total_clicks: string;
      estimated_revenue: string;
    }>(sql, [date]);

    const metrics = rows[0];

    // Use max of cached and calculated values
    const totalSearches = Math.max(
      parseInt(metrics.total_searches, 10),
      cachedSearches
    );
    const totalImpressions = Math.max(
      parseInt(metrics.total_impressions, 10),
      cachedImpressions
    );
    const totalClicks = Math.max(
      parseInt(metrics.total_clicks, 10),
      cachedClicks
    );

    // Upsert daily metrics
    const upsertSql = `
      INSERT INTO daily_metrics (
        metric_date, total_searches, total_impressions, total_clicks,
        estimated_revenue, unique_devices, avg_response_time_ms,
        top_categories, country_breakdown
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_date) DO UPDATE SET
        total_searches = EXCLUDED.total_searches,
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        estimated_revenue = EXCLUDED.estimated_revenue,
        unique_devices = EXCLUDED.unique_devices,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        top_categories = EXCLUDED.top_categories,
        country_breakdown = EXCLUDED.country_breakdown,
        updated_at = NOW()
    `;

    await query(upsertSql, [
      date,
      totalSearches,
      totalImpressions,
      totalClicks,
      parseFloat(metrics.estimated_revenue),
      parseInt(metrics.unique_devices, 10),
      parseInt(metrics.avg_response_time, 10),
      JSON.stringify(metrics.top_categories),
      JSON.stringify(metrics.country_breakdown),
    ]);

    // Clear cached counters for this date (they've been persisted)
    await Promise.all([
      cacheDelete(`metrics:searches:${dateStr}`),
      cacheDelete(`metrics:clicks:${dateStr}`),
      cacheDelete(`metrics:impressions:${dateStr}`),
    ]);

    // Invalidate dashboard cache
    await cacheDelete('transparency:dashboard');

    logger.info(`Job ${jobName} completed successfully`, {
      date: dateStr,
      searches: totalSearches,
      impressions: totalImpressions,
      clicks: totalClicks,
      estimatedRevenue: parseFloat(metrics.estimated_revenue),
    });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      date: dateStr,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Update confirmed revenue from revenue records
 * Links revenue reports to daily metrics
 */
export async function updateConfirmedRevenue(): Promise<void> {
  const jobName = 'update-confirmed-revenue';
  logger.info(`Starting job: ${jobName}`);

  try {
    const sql = `
      UPDATE daily_metrics dm
      SET
        confirmed_revenue = rr.our_share,
        updated_at = NOW()
      FROM revenue_records rr
      WHERE rr.report_date = dm.metric_date
        AND rr.report_type = 'daily'
        AND rr.verified = true
        AND (dm.confirmed_revenue IS NULL OR dm.confirmed_revenue != rr.our_share)
    `;

    const { rowCount } = await query(sql);

    logger.info(`Job ${jobName} completed`, { updated: rowCount });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Data retention job - purge old data
 * Keeps last 90 days of detailed data, aggregates older data
 */
export async function enforceDataRetention(): Promise<void> {
  const jobName = 'data-retention';
  logger.info(`Starting job: ${jobName}`);

  try {
    await transaction(async (client) => {
      // Delete search sessions older than 30 days
      const sessionResult = await client.query(`
        DELETE FROM search_sessions
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);

      // Delete audit logs older than 365 days
      const auditResult = await client.query(`
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '365 days'
      `);

      logger.info(`Job ${jobName} completed`, {
        sessionsDeleted: sessionResult.rowCount,
        auditLogsDeleted: auditResult.rowCount,
      });
    });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Start all scheduled metrics jobs
 */
export function startMetricsJobs(): void {
  // Daily metrics calculation at 1 AM UTC
  cron.schedule('0 1 * * *', async () => {
    try {
      await calculateDailyMetrics();
    } catch (error) {
      logger.error('Scheduled daily metrics job failed', {
        error: (error as Error).message,
      });
    }
  });

  // Update confirmed revenue at 2 AM UTC
  cron.schedule('0 2 * * *', async () => {
    try {
      await updateConfirmedRevenue();
    } catch (error) {
      logger.error('Scheduled revenue update job failed', {
        error: (error as Error).message,
      });
    }
  });

  // Data retention at 3 AM UTC on Sundays
  cron.schedule('0 3 * * 0', async () => {
    try {
      await enforceDataRetention();
    } catch (error) {
      logger.error('Scheduled data retention job failed', {
        error: (error as Error).message,
      });
    }
  });

  logger.info('Metrics jobs scheduled');
}

// Allow running as standalone script
if (require.main === module) {
  const dateArg = process.argv[2];
  const targetDate = dateArg ? new Date(dateArg) : undefined;

  calculateDailyMetrics(targetDate)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
