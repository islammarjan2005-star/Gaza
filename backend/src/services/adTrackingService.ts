import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { cacheIncrement } from '../config/redis';
import { logger } from '../utils/logger';
import {
  SearchSession,
  AdImpression,
  AdClick,
  AdClickRequest,
} from '../types';

export class AdTrackingService {
  /**
   * Record a new search session
   */
  async recordSession(session: SearchSession): Promise<string> {
    const sql = `
      INSERT INTO search_sessions (
        id, session_token, query_hash, query_category,
        result_count, ad_count, response_time_ms,
        device_type, country_code, safe_search_level, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const { rows } = await query<{ id: string }>(sql, [
      session.id,
      session.sessionToken,
      session.queryHash,
      session.queryCategory,
      session.resultCount,
      session.adCount,
      session.responseTimeMs,
      session.deviceType,
      session.countryCode,
      session.safeSearchLevel,
      session.createdAt,
    ]);

    // Increment daily search counter
    const today = new Date().toISOString().split('T')[0];
    await cacheIncrement(`metrics:searches:${today}`);

    logger.debug('Search session recorded', { sessionId: session.id });
    return rows[0].id;
  }

  /**
   * Record an ad impression
   */
  async recordImpression(impression: Omit<AdImpression, 'id'>): Promise<string> {
    const id = uuidv4();

    const sql = `
      INSERT INTO ad_impressions (
        id, session_id, ad_id, ad_position, ad_type,
        advertiser_domain, estimated_cpm, is_brand_safe,
        content_category, impression_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    await query(sql, [
      id,
      impression.sessionId,
      impression.adId,
      impression.adPosition,
      impression.adType,
      impression.advertiserDomain,
      impression.estimatedCpm,
      impression.isBrandSafe,
      impression.contentCategory,
      impression.impressionTimestamp,
    ]);

    // Increment daily impression counter
    const today = new Date().toISOString().split('T')[0];
    await cacheIncrement(`metrics:impressions:${today}`);

    return id;
  }

  /**
   * Record an ad click
   */
  async recordClick(clickRequest: AdClickRequest): Promise<{ clickId: string; destinationUrl: string }> {
    // Get the impression details first
    const impressionSql = `
      SELECT ai.*, ss.session_token
      FROM ad_impressions ai
      JOIN search_sessions ss ON ss.id = ai.session_id
      WHERE ai.id = $1
    `;

    const { rows: impressions } = await query<AdImpression & { session_token: string }>(
      impressionSql,
      [clickRequest.impressionId]
    );

    if (impressions.length === 0) {
      throw new Error('Invalid impression ID');
    }

    const impression = impressions[0];
    const clickId = uuidv4();

    // Estimate CPC (actual value comes from Microsoft reports later)
    const estimatedCpc = this.estimateCpc(impression.adType, impression.adPosition);

    const sql = `
      INSERT INTO ad_clicks (
        id, impression_id, session_id, click_timestamp,
        click_position, estimated_cpc, revenue_confirmed
      ) VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id
    `;

    await query(sql, [
      clickId,
      clickRequest.impressionId,
      clickRequest.sessionId,
      new Date(),
      clickRequest.position,
      estimatedCpc,
    ]);

    // Increment daily click counter
    const today = new Date().toISOString().split('T')[0];
    await cacheIncrement(`metrics:clicks:${today}`);

    logger.info('Ad click recorded', {
      clickId,
      impressionId: clickRequest.impressionId,
      estimatedCpc,
    });

    return {
      clickId,
      destinationUrl: '', // Will be provided by the controller
    };
  }

  /**
   * Get click tracking stats for a date range
   */
  async getClickStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalClicks: number;
    totalImpressions: number;
    ctr: number;
    estimatedRevenue: number;
  }> {
    const sql = `
      SELECT
        COUNT(DISTINCT ac.id) as total_clicks,
        COUNT(DISTINCT ai.id) as total_impressions,
        COALESCE(SUM(ac.estimated_cpc), 0) as estimated_revenue
      FROM ad_impressions ai
      LEFT JOIN ad_clicks ac ON ac.impression_id = ai.id
      WHERE ai.impression_timestamp >= $1 AND ai.impression_timestamp < $2
    `;

    const { rows } = await query<{
      total_clicks: string;
      total_impressions: string;
      estimated_revenue: string;
    }>(sql, [startDate, endDate]);

    const totalClicks = parseInt(rows[0].total_clicks, 10);
    const totalImpressions = parseInt(rows[0].total_impressions, 10);
    const estimatedRevenue = parseFloat(rows[0].estimated_revenue);

    return {
      totalClicks,
      totalImpressions,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      estimatedRevenue,
    };
  }

  /**
   * Update click with actual revenue from Microsoft reports
   */
  async updateClickRevenue(
    clickIds: string[],
    revenueData: Array<{ clickId: string; actualRevenue: number }>
  ): Promise<void> {
    await transaction(async (client) => {
      for (const { clickId, actualRevenue } of revenueData) {
        await client.query(
          `
          UPDATE ad_clicks
          SET actual_revenue = $1,
              revenue_confirmed = true,
              confirmation_date = NOW()
          WHERE id = $2
          `,
          [actualRevenue, clickId]
        );
      }
    });

    logger.info('Click revenue updated', { count: revenueData.length });
  }

  /**
   * Estimate CPC based on ad type and position
   * These are rough estimates; actual values come from Microsoft reports
   */
  private estimateCpc(adType: string, position: number): number {
    const baseRates: Record<string, number> = {
      mainline: 0.50,
      sponsored_link: 0.35,
      sidebar: 0.20,
    };

    const baseRate = baseRates[adType] || 0.30;

    // Higher positions typically have higher CPCs
    const positionMultiplier = Math.max(0.5, 1.2 - position * 0.1);

    return baseRate * positionMultiplier;
  }

  /**
   * Validate click is not fraudulent
   */
  async validateClick(
    impressionId: string,
    sessionToken: string
  ): Promise<boolean> {
    // Check if impression exists and matches session
    const sql = `
      SELECT COUNT(*) as count
      FROM ad_impressions ai
      JOIN search_sessions ss ON ss.id = ai.session_id
      WHERE ai.id = $1 AND ss.session_token = $2
    `;

    const { rows } = await query<{ count: string }>(sql, [
      impressionId,
      sessionToken,
    ]);

    if (parseInt(rows[0].count, 10) === 0) {
      logger.warn('Invalid click attempt', { impressionId, sessionToken });
      return false;
    }

    // Check for duplicate clicks (within 1 minute)
    const duplicateSql = `
      SELECT COUNT(*) as count
      FROM ad_clicks
      WHERE impression_id = $1
        AND click_timestamp > NOW() - INTERVAL '1 minute'
    `;

    const { rows: dupRows } = await query<{ count: string }>(duplicateSql, [
      impressionId,
    ]);

    if (parseInt(dupRows[0].count, 10) > 0) {
      logger.warn('Duplicate click detected', { impressionId });
      return false;
    }

    return true;
  }
}

export const adTrackingService = new AdTrackingService();
