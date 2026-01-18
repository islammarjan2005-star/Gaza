import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { charityService } from '../services/charityService';
import { logger } from '../utils/logger';

const addCharitySchema = z.object({
  name: z.string().min(2).max(255),
  legalName: z.string().min(2).max(255),
  registrationNumber: z.string().optional(),
  country: z.string().min(2).max(100),
  description: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

const updateAllocationSchema = z.object({
  allocations: z.array(
    z.object({
      charityId: z.string().uuid(),
      percentage: z.number().min(0).max(100),
    })
  ),
});

const vettingSchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended']),
  notes: z.string(),
});

export class CharityController {
  /**
   * Get all active charities
   * GET /api/v1/charities
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const charities = await charityService.getActiveCharities();

      res.json({
        success: true,
        data: charities,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get charity by ID
   * GET /api/v1/charities/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const charity = await charityService.getCharityById(id);

      if (!charity) {
        res.status(404).json({ error: 'Charity not found' });
        return;
      }

      res.json({
        success: true,
        data: charity,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add new charity (admin only)
   * POST /api/v1/charities
   */
  async add(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = addCharitySchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid charity data',
          details: validation.error.issues,
        });
        return;
      }

      const charity = await charityService.addCharity(validation.data);

      logger.info('Charity added', { charityId: charity.id, name: charity.name });

      res.status(201).json({
        success: true,
        data: charity,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update charity vetting status (admin only)
   * PATCH /api/v1/charities/:id/vetting
   */
  async updateVetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validation = vettingSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid vetting data',
          details: validation.error.issues,
        });
        return;
      }

      const { status, notes } = validation.data;
      const approvedBy = (req as any).admin?.email || 'system';

      await charityService.updateVettingStatus(id, status, notes, approvedBy);

      res.json({
        success: true,
        message: `Charity vetting status updated to ${status}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update allocation percentages (admin only)
   * PUT /api/v1/charities/allocations
   */
  async updateAllocations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = updateAllocationSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid allocation data',
          details: validation.error.issues,
        });
        return;
      }

      await charityService.updateAllocations(validation.data.allocations);

      res.json({
        success: true,
        message: 'Allocations updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get donation summary
   * GET /api/v1/charities/donations
   */
  async getDonationSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await charityService.getDonationSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create monthly disbursements (admin only)
   * POST /api/v1/charities/disbursements
   */
  async createDisbursements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { period } = req.body;

      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        res.status(400).json({ error: 'Invalid period format. Use YYYY-MM' });
        return;
      }

      const disbursements = await charityService.createMonthlyDisbursements(period);

      res.json({
        success: true,
        data: disbursements,
        message: `Created ${disbursements.length} disbursements for ${period}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve disbursement (admin only)
   * POST /api/v1/charities/disbursements/:id/approve
   */
  async approveDisbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const approvedBy = (req as any).admin?.email || 'system';

      await charityService.approveDisbursement(id, approvedBy);

      res.json({
        success: true,
        message: 'Disbursement approved',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark disbursement as sent (admin only)
   * POST /api/v1/charities/disbursements/:id/sent
   */
  async markSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { transferReference, transferMethod } = req.body;

      if (!transferReference) {
        res.status(400).json({ error: 'Transfer reference required' });
        return;
      }

      await charityService.markDisbursementSent(
        id,
        transferReference,
        transferMethod || 'wire'
      );

      res.json({
        success: true,
        message: 'Disbursement marked as sent',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload receipt (admin only)
   * POST /api/v1/charities/disbursements/:id/receipt
   */
  async uploadReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { receiptNumber, receiptDate, receivedAmount, fileUrl, fileHash } = req.body;

      if (!fileUrl || !receivedAmount) {
        res.status(400).json({ error: 'File URL and received amount required' });
        return;
      }

      const receipt = await charityService.uploadReceipt(id, {
        receiptNumber,
        receiptDate: receiptDate ? new Date(receiptDate) : undefined,
        receivedAmount,
        fileUrl,
        fileHash: fileHash || '',
      });

      res.json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent disbursements
   * GET /api/v1/charities/disbursements/recent
   */
  async getRecentDisbursements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const disbursements = await charityService.getRecentDisbursements(limit);

      res.json({
        success: true,
        data: disbursements,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const charityController = new CharityController();
