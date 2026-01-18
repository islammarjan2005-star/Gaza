import { query } from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';
import { TransparencyData } from '../types';
import { charityService } from './charityService';
import { microsoftAdsService } from './microsoftAdsService';

export class TransparencyService {
  private readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get complete transparency data for the dashboard
   */
  async getTransparencyData(): Promise<TransparencyData> {
    const cacheKey = 'transparency:dashboard';
    const cached = await cacheGet<TransparencyData>(cacheKey);

    if (cached) {
      return cached;
    }

    const [
      revenueSummary,
      searchStats,
      charities,
      recentDisbursements,
    ] = await Promise.all([
      microsoftAdsService.getRevenueSummary(),
      this.getSearchStats(),
      charityService.getDonationSummary(),
      charityService.getRecentDisbursements(10),
    ]);

    const totalDonated = charities.reduce((sum, c) => sum + c.totalDonated, 0);

    const data: TransparencyData = {
      totalDonated,
      totalSearches: searchStats.totalSearches,
      todayRevenue: revenueSummary.today,
      weekRevenue: revenueSummary.thisWeek,
      monthRevenue: revenueSummary.thisMonth,
      charities,
      recentDisbursements,
    };

    await cacheSet(cacheKey, data, this.CACHE_TTL);

    return data;
  }

  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<{
    totalSearches: number;
    todaySearches: number;
    weekSearches: number;
    monthSearches: number;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total_searches,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_searches,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as week_searches,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as month_searches
      FROM search_sessions
    `;

    const { rows } = await query<{
      total_searches: string;
      today_searches: string;
      week_searches: string;
      month_searches: string;
    }>(sql);

    return {
      totalSearches: parseInt(rows[0].total_searches, 10),
      todaySearches: parseInt(rows[0].today_searches, 10),
      weekSearches: parseInt(rows[0].week_searches, 10),
      monthSearches: parseInt(rows[0].month_searches, 10),
    };
  }

  /**
   * Get daily impact metrics for visualization
   */
  async getDailyImpactMetrics(days: number = 30): Promise<
    Array<{
      date: string;
      searches: number;
      revenue: number;
      clicks: number;
    }>
  > {
    const sql = `
      SELECT
        DATE(dm.metric_date) as date,
        dm.total_searches as searches,
        COALESCE(rr.our_share, 0) as revenue,
        dm.total_clicks as clicks
      FROM daily_metrics dm
      LEFT JOIN revenue_records rr ON rr.report_date = dm.metric_date AND rr.report_type = 'daily'
      WHERE dm.metric_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY dm.metric_date DESC
    `;

    const { rows } = await query<{
      date: Date;
      searches: string;
      revenue: string;
      clicks: string;
    }>(sql);

    return rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      searches: parseInt(row.searches, 10),
      revenue: parseFloat(row.revenue),
      clicks: parseInt(row.clicks, 10),
    }));
  }

  /**
   * Calculate user impact - how much their searches have contributed
   */
  async calculateUserImpact(searchCount: number): Promise<{
    estimatedContribution: number;
    mealsProvided: number;
    waterLiters: number;
    medicalKits: number;
  }> {
    // Get average revenue per search
    const sql = `
      SELECT
        COALESCE(SUM(our_share), 0) / NULLIF(COUNT(*), 0) as avg_revenue_per_search
      FROM revenue_records rr
      CROSS JOIN (SELECT COUNT(*) as search_count FROM search_sessions) sc
    `;

    const { rows } = await query<{ avg_revenue_per_search: string }>(sql);
    const avgRevenuePerSearch = parseFloat(rows[0].avg_revenue_per_search) || 0.003;

    const estimatedContribution = searchCount * avgRevenuePerSearch;

    // Impact calculations (approximate costs in Gaza context)
    const mealCost = 2.5;
    const waterLiterCost = 0.05;
    const medicalKitCost = 25;

    return {
      estimatedContribution,
      mealsProvided: Math.floor(estimatedContribution / mealCost),
      waterLiters: Math.floor(estimatedContribution / waterLiterCost),
      medicalKits: Math.floor(estimatedContribution / medicalKitCost),
    };
  }

  /**
   * Get real-time live counter data
   */
  async getLiveCounters(): Promise<{
    searchesToday: number;
    clicksToday: number;
    revenueToday: number;
    activeUsers: number;
  }> {
    // Try cache first for real-time counters
    const today = new Date().toISOString().split('T')[0];

    const [searches, clicks] = await Promise.all([
      cacheGet<number>(`metrics:searches:${today}`),
      cacheGet<number>(`metrics:clicks:${today}`),
    ]);

    // Get active users (unique sessions in last 15 minutes)
    const activeSql = `
      SELECT COUNT(DISTINCT session_token) as active
      FROM search_sessions
      WHERE created_at >= NOW() - INTERVAL '15 minutes'
    `;

    const { rows } = await query<{ active: string }>(activeSql);

    return {
      searchesToday: searches || 0,
      clicksToday: clicks || 0,
      revenueToday: 0, // Updated from daily job
      activeUsers: parseInt(rows[0].active, 10),
    };
  }

  /**
   * Get charity impact breakdown
   */
  async getCharityImpactBreakdown(): Promise<
    Array<{
      charityId: string;
      charityName: string;
      totalReceived: number;
      disbursementCount: number;
      latestPeriod: string;
      impactDescription: string;
    }>
  > {
    const sql = `
      SELECT
        cp.id as charity_id,
        cp.name as charity_name,
        COALESCE(SUM(d.net_amount), 0) as total_received,
        COUNT(d.id) FILTER (WHERE d.status = 'confirmed') as disbursement_count,
        MAX(d.disbursement_period) as latest_period,
        cp.description as impact_description
      FROM charity_partners cp
      LEFT JOIN disbursements d ON d.charity_id = cp.id AND d.status = 'confirmed'
      WHERE cp.is_active = true
      GROUP BY cp.id, cp.name, cp.description
      ORDER BY total_received DESC
    `;

    const { rows } = await query<{
      charity_id: string;
      charity_name: string;
      total_received: string;
      disbursement_count: string;
      latest_period: string;
      impact_description: string;
    }>(sql);

    return rows.map((row) => ({
      charityId: row.charity_id,
      charityName: row.charity_name,
      totalReceived: parseFloat(row.total_received),
      disbursementCount: parseInt(row.disbursement_count, 10),
      latestPeriod: row.latest_period,
      impactDescription: row.impact_description || '',
    }));
  }

  /**
   * Generate monthly transparency report
   */
  async generateMonthlyReport(period: string): Promise<{
    period: string;
    totalSearches: number;
    totalImpressions: number;
    totalClicks: number;
    grossRevenue: number;
    netRevenue: number;
    disbursements: Array<{
      charityName: string;
      amount: number;
      status: string;
    }>;
  }> {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get metrics
    const metricsSql = `
      SELECT
        COALESCE(SUM(total_searches), 0) as searches,
        COALESCE(SUM(total_impressions), 0) as impressions,
        COALESCE(SUM(total_clicks), 0) as clicks
      FROM daily_metrics
      WHERE metric_date >= $1 AND metric_date <= $2
    `;

    const { rows: metricsRows } = await query<{
      searches: string;
      impressions: string;
      clicks: string;
    }>(metricsSql, [startDate, endDate]);

    // Get revenue
    const revenueSql = `
      SELECT
        COALESCE(SUM(gross_revenue), 0) as gross,
        COALESCE(SUM(our_share), 0) as net
      FROM revenue_records
      WHERE report_date >= $1 AND report_date <= $2
    `;

    const { rows: revenueRows } = await query<{
      gross: string;
      net: string;
    }>(revenueSql, [startDate, endDate]);

    // Get disbursements
    const disbursementsSql = `
      SELECT
        cp.name as charity_name,
        d.net_amount as amount,
        d.status
      FROM disbursements d
      JOIN charity_partners cp ON cp.id = d.charity_id
      WHERE d.disbursement_period = $1
    `;

    const { rows: disbursementRows } = await query<{
      charity_name: string;
      amount: string;
      status: string;
    }>(disbursementsSql, [period]);

    return {
      period,
      totalSearches: parseInt(metricsRows[0].searches, 10),
      totalImpressions: parseInt(metricsRows[0].impressions, 10),
      totalClicks: parseInt(metricsRows[0].clicks, 10),
      grossRevenue: parseFloat(revenueRows[0].gross),
      netRevenue: parseFloat(revenueRows[0].net),
      disbursements: disbursementRows.map((row) => ({
        charityName: row.charity_name,
        amount: parseFloat(row.amount),
        status: row.status,
      })),
    };
  }
}

export const transparencyService = new TransparencyService();
