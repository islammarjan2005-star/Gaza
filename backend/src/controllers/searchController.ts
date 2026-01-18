import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { bingSearchService } from '../services/bingSearchService';
import { logger } from '../utils/logger';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  count: z.coerce.number().min(1).max(50).optional().default(10),
  offset: z.coerce.number().min(0).optional().default(0),
  market: z.string().optional().default('en-US'),
  safeSearch: z.enum(['off', 'moderate', 'strict']).optional().default('moderate'),
  freshness: z.enum(['Day', 'Week', 'Month']).optional(),
});

export class SearchController {
  /**
   * Handle search request
   * GET /api/v1/search
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = searchQuerySchema.safeParse(req.query);

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid search parameters',
          details: validation.error.issues,
        });
        return;
      }

      const { q, count, offset, market, safeSearch, freshness } = validation.data;

      // Get session token from header or generate one
      const sessionToken = req.headers['x-session-token'] as string || req.ip || 'anonymous';

      // Determine device type from user agent
      const userAgent = req.headers['user-agent'] || '';
      const deviceType = this.detectDeviceType(userAgent);

      const response = await bingSearchService.search({
        query: q,
        count,
        offset,
        market,
        safeSearch,
        freshness,
        sessionToken,
        deviceType,
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Search request failed', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Get search suggestions
   * GET /api/v1/search/suggestions
   */
  async suggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }

      // In production, this would call Bing Autosuggest API
      // For MVP, return empty array
      res.json({
        success: true,
        suggestions: [],
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trending searches
   * GET /api/v1/search/trending
   */
  async trending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // In production, this would aggregate popular searches
      // For MVP, return static list
      res.json({
        success: true,
        trending: [
          'humanitarian aid gaza',
          'gaza relief organizations',
          'donate to gaza',
          'gaza news today',
          'medical supplies gaza',
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  private detectDeviceType(userAgent: string): 'ios' | 'android' | 'web' {
    const ua = userAgent.toLowerCase();

    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
      return 'ios';
    }

    if (ua.includes('android')) {
      return 'android';
    }

    return 'web';
  }
}

export const searchController = new SearchController();
