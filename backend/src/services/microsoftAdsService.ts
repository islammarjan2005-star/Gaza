import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { query, transaction } from '../config/database';
import { logger } from '../utils/logger';
import { RevenueRecord, MicrosoftAdsReportRow, RevenueAggregation } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class MicrosoftAdsService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly OAUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly REPORTING_URL = 'https://reporting.api.bingads.microsoft.com/Api/Advertiser/V13/Reporting';

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with Microsoft Ads API
   */
  private async authenticate(): Promise<void> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    try {
      const params = new URLSearchParams({
        client_id: config.microsoftAdsClientId,
        client_secret: config.microsoftAdsClientSecret,
        refresh_token: config.microsoftAdsRefreshToken,
        grant_type: 'refresh_token',
        scope: 'https://ads.microsoft.com/.default',
      });

      const response = await axios.post<TokenResponse>(this.OAUTH_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      logger.info('Microsoft Ads authentication successful');
    } catch (error) {
      logger.error('Microsoft Ads authentication failed', {
        error: (error as Error).message,
      });
      throw new Error('Failed to authenticate with Microsoft Ads');
    }
  }

  /**
   * Fetch revenue report for a date range
   */
  async fetchRevenueReport(
    startDate: Date,
    endDate: Date,
    reportType: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<MicrosoftAdsReportRow[]> {
    await this.authenticate();

    const reportRequest = {
      ReportName: `Revenue_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`,
      Format: 'Csv',
      Language: 'English',
      ReportType: 'AccountPerformanceReport',
      Scope: {
        AccountIds: [config.microsoftAdsAccountId],
      },
      Time: {
        CustomDateRangeStart: {
          Day: startDate.getDate(),
          Month: startDate.getMonth() + 1,
          Year: startDate.getFullYear(),
        },
        CustomDateRangeEnd: {
          Day: endDate.getDate(),
          Month: endDate.getMonth() + 1,
          Year: endDate.getFullYear(),
        },
        ReportTimeZone: 'PacificTimeUSCanadaTijuana',
      },
      Columns: [
        'TimePeriod',
        'Impressions',
        'Clicks',
        'Spend',
        'Revenue',
        'AverageCpc',
        'AverageCpm',
      ],
    };

    try {
      const response = await this.client.post(
        `${this.REPORTING_URL}/SubmitGenerateReport`,
        { ReportRequest: reportRequest },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            DeveloperToken: config.microsoftAdsDeveloperToken,
            CustomerId: config.microsoftAdsCustomerId,
          },
        }
      );

      const reportId = response.data.ReportRequestId;

      // Poll for report completion
      const reportData = await this.pollReportStatus(reportId);
      return this.parseReportData(reportData);
    } catch (error) {
      logger.error('Failed to fetch revenue report', {
        error: (error as Error).message,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  /**
   * Poll for report completion and download
   */
  private async pollReportStatus(reportId: string): Promise<string> {
    const maxAttempts = 30;
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await this.client.post(
        `${this.REPORTING_URL}/PollGenerateReport`,
        { ReportRequestId: reportId },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            DeveloperToken: config.microsoftAdsDeveloperToken,
            CustomerId: config.microsoftAdsCustomerId,
          },
        }
      );

      const status = statusResponse.data.ReportRequestStatus?.Status;

      if (status === 'Success') {
        const reportUrl = statusResponse.data.ReportRequestStatus.ReportDownloadUrl;
        const reportResponse = await axios.get(reportUrl);
        return reportResponse.data;
      }

      if (status === 'Error') {
        throw new Error('Report generation failed');
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Report polling timeout');
  }

  /**
   * Parse CSV report data
   */
  private parseReportData(csvData: string): MicrosoftAdsReportRow[] {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows: MicrosoftAdsReportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));

      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      rows.push({
        date: row.TimePeriod || row.Date,
        impressions: parseInt(row.Impressions, 10) || 0,
        clicks: parseInt(row.Clicks, 10) || 0,
        spend: parseFloat(row.Spend) || 0,
        revenue: parseFloat(row.Revenue) || 0,
        cpc: parseFloat(row.AverageCpc) || 0,
        cpm: parseFloat(row.AverageCpm) || 0,
      });
    }

    return rows;
  }

  /**
   * Store revenue records in database
   */
  async storeRevenueRecords(
    records: MicrosoftAdsReportRow[],
    reportType: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    await transaction(async (client) => {
      for (const record of records) {
        const reportDate = new Date(record.date);

        // Microsoft typically keeps ~70% (varies by partner tier)
        const microsoftShare = record.revenue * 0.70;
        const ourShare = record.revenue * 0.30;

        const sql = `
          INSERT INTO revenue_records (
            id, report_date, report_type, gross_revenue,
            microsoft_share, our_share, click_count, impression_count,
            average_cpc, average_cpm, currency, raw_report_data, fetched_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'USD', $11, NOW())
          ON CONFLICT (report_date, report_type) DO UPDATE SET
            gross_revenue = EXCLUDED.gross_revenue,
            microsoft_share = EXCLUDED.microsoft_share,
            our_share = EXCLUDED.our_share,
            click_count = EXCLUDED.click_count,
            impression_count = EXCLUDED.impression_count,
            average_cpc = EXCLUDED.average_cpc,
            average_cpm = EXCLUDED.average_cpm,
            raw_report_data = EXCLUDED.raw_report_data,
            fetched_at = NOW()
        `;

        await client.query(sql, [
          uuidv4(),
          reportDate,
          reportType,
          record.revenue,
          microsoftShare,
          ourShare,
          record.clicks,
          record.impressions,
          record.cpc,
          record.cpm,
          JSON.stringify(record),
        ]);
      }
    });

    logger.info('Revenue records stored', { count: records.length, reportType });
  }

  /**
   * Get revenue summary for transparency dashboard
   */
  async getRevenueSummary(): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
    byMonth: Array<{ month: string; revenue: number }>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const sql = `
      SELECT
        COALESCE(SUM(CASE WHEN report_date = CURRENT_DATE THEN our_share ELSE 0 END), 0) as today,
        COALESCE(SUM(CASE WHEN report_date >= $1 THEN our_share ELSE 0 END), 0) as this_week,
        COALESCE(SUM(CASE WHEN report_date >= $2 THEN our_share ELSE 0 END), 0) as this_month,
        COALESCE(SUM(our_share), 0) as all_time
      FROM revenue_records
      WHERE verified = true
    `;

    const { rows } = await query<{
      today: string;
      this_week: string;
      this_month: string;
      all_time: string;
    }>(sql, [weekStart, monthStart]);

    // Get monthly breakdown
    const monthlySQL = `
      SELECT
        TO_CHAR(report_date, 'YYYY-MM') as month,
        SUM(our_share) as revenue
      FROM revenue_records
      WHERE verified = true
      GROUP BY TO_CHAR(report_date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `;

    const { rows: monthlyRows } = await query<{ month: string; revenue: string }>(monthlySQL);

    return {
      today: parseFloat(rows[0].today),
      thisWeek: parseFloat(rows[0].this_week),
      thisMonth: parseFloat(rows[0].this_month),
      allTime: parseFloat(rows[0].all_time),
      byMonth: monthlyRows.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
      })),
    };
  }

  /**
   * Verify revenue records (admin action)
   */
  async verifyRevenueRecords(
    startDate: Date,
    endDate: Date,
    verifiedBy: string
  ): Promise<number> {
    const sql = `
      UPDATE revenue_records
      SET verified = true, verified_at = NOW(), verified_by = $3
      WHERE report_date >= $1 AND report_date <= $2 AND verified = false
    `;

    const { rowCount } = await query(sql, [startDate, endDate, verifiedBy]);

    logger.info('Revenue records verified', {
      count: rowCount,
      startDate,
      endDate,
      verifiedBy,
    });

    return rowCount;
  }

  /**
   * Calculate revenue for charity disbursement
   */
  async calculateDisbursementAmount(period: string): Promise<{
    grossRevenue: number;
    netRevenue: number;
    verified: boolean;
  }> {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const sql = `
      SELECT
        COALESCE(SUM(our_share), 0) as net_revenue,
        COALESCE(SUM(gross_revenue), 0) as gross_revenue,
        COUNT(*) FILTER (WHERE verified = false) as unverified_count
      FROM revenue_records
      WHERE report_date >= $1 AND report_date <= $2
    `;

    const { rows } = await query<{
      net_revenue: string;
      gross_revenue: string;
      unverified_count: string;
    }>(sql, [startDate, endDate]);

    return {
      grossRevenue: parseFloat(rows[0].gross_revenue),
      netRevenue: parseFloat(rows[0].net_revenue),
      verified: parseInt(rows[0].unverified_count, 10) === 0,
    };
  }
}

export const microsoftAdsService = new MicrosoftAdsService();
