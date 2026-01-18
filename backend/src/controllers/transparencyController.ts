import { Request, Response, NextFunction } from 'express';
import { transparencyService } from '../services/transparencyService';
import { logger } from '../utils/logger';

export class TransparencyController {
  /**
   * Get main transparency dashboard data
   * GET /api/v1/transparency
   */
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await transparencyService.getTransparencyData();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get transparency data', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Get live counters for real-time display
   * GET /api/v1/transparency/live
   */
  async getLiveCounters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const counters = await transparencyService.getLiveCounters();

      res.json({
        success: true,
        data: counters,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get daily impact metrics for charts
   * GET /api/v1/transparency/metrics
   */
  async getDailyMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const metrics = await transparencyService.getDailyImpactMetrics(days);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate user impact based on search count
   * POST /api/v1/transparency/impact
   */
  async calculateImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { searchCount } = req.body;

      if (!searchCount || typeof searchCount !== 'number' || searchCount < 0) {
        res.status(400).json({ error: 'Invalid search count' });
        return;
      }

      const impact = await transparencyService.calculateUserImpact(searchCount);

      res.json({
        success: true,
        data: impact,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get charity impact breakdown
   * GET /api/v1/transparency/charities
   */
  async getCharityBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const breakdown = await transparencyService.getCharityImpactBreakdown();

      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get monthly transparency report
   * GET /api/v1/transparency/report/:period
   */
  async getMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { period } = req.params;

      // Validate period format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(period)) {
        res.status(400).json({ error: 'Invalid period format. Use YYYY-MM' });
        return;
      }

      const report = await transparencyService.generateMonthlyReport(period);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transparencyController = new TransparencyController();
