import cron from 'node-cron';
import { microsoftAdsService } from '../services/microsoftAdsService';
import { logger } from '../utils/logger';

/**
 * Revenue Sync Job
 * Fetches revenue data from Microsoft Ads Reporting API
 * Runs daily at 6 AM UTC (after Microsoft finalizes previous day's data)
 */
export async function syncDailyRevenue(): Promise<void> {
  const jobName = 'revenue-sync-daily';
  logger.info(`Starting job: ${jobName}`);

  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endDate = new Date(yesterday);
    endDate.setHours(23, 59, 59, 999);

    // Fetch revenue report
    const report = await microsoftAdsService.fetchRevenueReport(
      yesterday,
      endDate,
      'daily'
    );

    // Store in database
    await microsoftAdsService.storeRevenueRecords(report, 'daily');

    logger.info(`Job ${jobName} completed successfully`, {
      date: yesterday.toISOString().split('T')[0],
      records: report.length,
    });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Weekly Revenue Summary Job
 * Runs every Monday at 7 AM UTC
 */
export async function syncWeeklyRevenue(): Promise<void> {
  const jobName = 'revenue-sync-weekly';
  logger.info(`Starting job: ${jobName}`);

  try {
    // Get last week's date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7 days ago
    startDate.setHours(0, 0, 0, 0);

    const report = await microsoftAdsService.fetchRevenueReport(
      startDate,
      endDate,
      'weekly'
    );

    await microsoftAdsService.storeRevenueRecords(report, 'weekly');

    logger.info(`Job ${jobName} completed successfully`, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      records: report.length,
    });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Monthly Revenue Summary Job
 * Runs on the 2nd of each month at 8 AM UTC
 */
export async function syncMonthlyRevenue(): Promise<void> {
  const jobName = 'revenue-sync-monthly';
  logger.info(`Starting job: ${jobName}`);

  try {
    // Get last month's date range
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); // First day of previous month
    startDate.setHours(0, 0, 0, 0);

    const report = await microsoftAdsService.fetchRevenueReport(
      startDate,
      endDate,
      'monthly'
    );

    await microsoftAdsService.storeRevenueRecords(report, 'monthly');

    logger.info(`Job ${jobName} completed successfully`, {
      month: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
      records: report.length,
    });
  } catch (error) {
    logger.error(`Job ${jobName} failed`, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Start all scheduled revenue sync jobs
 */
export function startRevenueJobs(): void {
  // Daily sync at 6 AM UTC
  cron.schedule('0 6 * * *', async () => {
    try {
      await syncDailyRevenue();
    } catch (error) {
      logger.error('Scheduled daily revenue sync failed', {
        error: (error as Error).message,
      });
    }
  });

  // Weekly sync on Mondays at 7 AM UTC
  cron.schedule('0 7 * * 1', async () => {
    try {
      await syncWeeklyRevenue();
    } catch (error) {
      logger.error('Scheduled weekly revenue sync failed', {
        error: (error as Error).message,
      });
    }
  });

  // Monthly sync on 2nd of month at 8 AM UTC
  cron.schedule('0 8 2 * *', async () => {
    try {
      await syncMonthlyRevenue();
    } catch (error) {
      logger.error('Scheduled monthly revenue sync failed', {
        error: (error as Error).message,
      });
    }
  });

  logger.info('Revenue sync jobs scheduled');
}

// Allow running as standalone script
if (require.main === module) {
  syncDailyRevenue()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
