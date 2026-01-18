import { Router } from 'express';
import { searchController } from '../controllers/searchController';
import { adController } from '../controllers/adController';
import { transparencyController } from '../controllers/transparencyController';
import { charityController } from '../controllers/charityController';
import { requireAdmin, requireApiKey } from '../middleware/auth';
import { searchLimiter, clickLimiter, adminLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Health check endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  try {
    const { healthCheck: dbHealth } = await import('../config/database');
    const { healthCheck: redisHealth } = await import('../config/redis');

    const [dbOk, redisOk] = await Promise.all([dbHealth(), redisHealth()]);

    if (dbOk && redisOk) {
      res.json({ status: 'ready', database: 'ok', cache: 'ok' });
    } else {
      res.status(503).json({
        status: 'not ready',
        database: dbOk ? 'ok' : 'error',
        cache: redisOk ? 'ok' : 'error',
      });
    }
  } catch (error) {
    res.status(503).json({ status: 'error', message: (error as Error).message });
  }
});

// =============================================================================
// SEARCH ROUTES (Public)
// =============================================================================

router.get(
  '/search',
  searchLimiter,
  asyncHandler(searchController.search.bind(searchController))
);

router.get(
  '/search/suggestions',
  asyncHandler(searchController.suggestions.bind(searchController))
);

router.get(
  '/search/trending',
  asyncHandler(searchController.trending.bind(searchController))
);

// =============================================================================
// AD ROUTES
// =============================================================================

router.get(
  '/ads/click',
  clickLimiter,
  asyncHandler(adController.handleClick.bind(adController))
);

router.post(
  '/ads/impression',
  asyncHandler(adController.reportImpression.bind(adController))
);

router.get(
  '/ads/stats',
  requireAdmin,
  adminLimiter,
  asyncHandler(adController.getStats.bind(adController))
);

// =============================================================================
// TRANSPARENCY ROUTES (Public)
// =============================================================================

router.get(
  '/transparency',
  asyncHandler(transparencyController.getDashboard.bind(transparencyController))
);

router.get(
  '/transparency/live',
  asyncHandler(transparencyController.getLiveCounters.bind(transparencyController))
);

router.get(
  '/transparency/metrics',
  asyncHandler(transparencyController.getDailyMetrics.bind(transparencyController))
);

router.post(
  '/transparency/impact',
  asyncHandler(transparencyController.calculateImpact.bind(transparencyController))
);

router.get(
  '/transparency/charities',
  asyncHandler(transparencyController.getCharityBreakdown.bind(transparencyController))
);

router.get(
  '/transparency/report/:period',
  asyncHandler(transparencyController.getMonthlyReport.bind(transparencyController))
);

// =============================================================================
// CHARITY ROUTES
// =============================================================================

// Public routes
router.get(
  '/charities',
  asyncHandler(charityController.list.bind(charityController))
);

router.get(
  '/charities/donations',
  asyncHandler(charityController.getDonationSummary.bind(charityController))
);

router.get(
  '/charities/disbursements/recent',
  asyncHandler(charityController.getRecentDisbursements.bind(charityController))
);

router.get(
  '/charities/:id',
  asyncHandler(charityController.getById.bind(charityController))
);

// Admin routes
router.post(
  '/charities',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.add.bind(charityController))
);

router.patch(
  '/charities/:id/vetting',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.updateVetting.bind(charityController))
);

router.put(
  '/charities/allocations',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.updateAllocations.bind(charityController))
);

router.post(
  '/charities/disbursements',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.createDisbursements.bind(charityController))
);

router.post(
  '/charities/disbursements/:id/approve',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.approveDisbursement.bind(charityController))
);

router.post(
  '/charities/disbursements/:id/sent',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.markSent.bind(charityController))
);

router.post(
  '/charities/disbursements/:id/receipt',
  requireAdmin,
  adminLimiter,
  asyncHandler(charityController.uploadReceipt.bind(charityController))
);

// =============================================================================
// PRIVACY ROUTES
// =============================================================================

router.get('/privacy/export', async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'] as string;

    if (!sessionToken) {
      res.status(400).json({ error: 'Session token required' });
      return;
    }

    const { exportUserData } = await import('../middleware/privacy');
    const data = await exportUserData(sessionToken);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/privacy/data', async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'] as string;

    if (!sessionToken) {
      res.status(400).json({ error: 'Session token required' });
      return;
    }

    const { deleteUserData } = await import('../middleware/privacy');
    const result = await deleteUserData(sessionToken);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
