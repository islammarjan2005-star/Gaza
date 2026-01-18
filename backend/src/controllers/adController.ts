import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adTrackingService } from '../services/adTrackingService';
import { logger } from '../utils/logger';

const clickSchema = z.object({
  imp: z.string().uuid(),
  dest: z.string(),
});

export class AdController {
  /**
   * Handle ad click and redirect
   * GET /api/v1/ads/click
   */
  async handleClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = clickSchema.safeParse(req.query);

      if (!validation.success) {
        res.status(400).json({ error: 'Invalid click parameters' });
        return;
      }

      const { imp: impressionId, dest: encodedDest } = validation.data;

      // Decode destination URL
      let destinationUrl: string;
      try {
        destinationUrl = Buffer.from(encodedDest, 'base64').toString('utf-8');
      } catch {
        res.status(400).json({ error: 'Invalid destination' });
        return;
      }

      // Validate the click
      const sessionToken = req.headers['x-session-token'] as string || req.ip || 'anonymous';
      const isValid = await adTrackingService.validateClick(impressionId, sessionToken);

      if (!isValid) {
        // Still redirect but don't record the click
        logger.warn('Invalid click attempt', { impressionId, ip: req.ip });
        res.redirect(destinationUrl);
        return;
      }

      // Record the click
      await adTrackingService.recordClick({
        impressionId,
        sessionId: '', // Will be looked up from impression
        position: 0,
      });

      // Redirect to destination
      res.redirect(destinationUrl);
    } catch (error) {
      logger.error('Click handling failed', { error: (error as Error).message });
      // Still try to redirect if we have a destination
      const dest = req.query.dest as string;
      if (dest) {
        try {
          const url = Buffer.from(dest, 'base64').toString('utf-8');
          res.redirect(url);
          return;
        } catch {
          // Fall through to error
        }
      }
      next(error);
    }
  }

  /**
   * Report ad impression (for client-side tracking)
   * POST /api/v1/ads/impression
   */
  async reportImpression(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { impressionId, viewTime } = req.body;

      // This endpoint is for additional impression data
      // Primary impression is recorded during search
      logger.debug('Impression report received', { impressionId, viewTime });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get click statistics (admin only)
   * GET /api/v1/ads/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const stats = await adTrackingService.getClickStats(start, end);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adController = new AdController();
