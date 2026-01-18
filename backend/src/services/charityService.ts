import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query, transaction } from '../config/database';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  CharityPartner,
  Disbursement,
  DonationReceipt,
  CharityDonationSummary,
  DisbursementSummary,
} from '../types';
import { microsoftAdsService } from './microsoftAdsService';

export class CharityService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    this.encryptionKey = Buffer.from(config.encryptionKey, 'utf-8').slice(0, 32);
  }

  /**
   * Get all active charity partners
   */
  async getActiveCharities(): Promise<CharityPartner[]> {
    const sql = `
      SELECT
        id, name, legal_name, registration_number, country,
        description, website_url, logo_url, vetting_status,
        vetting_date, allocation_percentage, is_active,
        created_at, updated_at
      FROM charity_partners
      WHERE is_active = true AND vetting_status = 'approved'
      ORDER BY name
    `;

    const { rows } = await query<any>(sql);

    return rows.map(this.mapCharityRow);
  }

  /**
   * Get charity details by ID
   */
  async getCharityById(id: string): Promise<CharityPartner | null> {
    const sql = `
      SELECT * FROM charity_partners WHERE id = $1
    `;

    const { rows } = await query<any>(sql, [id]);

    if (rows.length === 0) return null;

    return this.mapCharityRow(rows[0]);
  }

  /**
   * Add a new charity partner
   */
  async addCharity(charity: Partial<CharityPartner>): Promise<CharityPartner> {
    const id = uuidv4();

    const sql = `
      INSERT INTO charity_partners (
        id, name, legal_name, registration_number, country,
        description, website_url, logo_url, vetting_status,
        allocation_percentage, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, false)
      RETURNING *
    `;

    const { rows } = await query<any>(sql, [
      id,
      charity.name,
      charity.legalName,
      charity.registrationNumber,
      charity.country,
      charity.description,
      charity.websiteUrl,
      charity.logoUrl,
      charity.allocationPercentage || 0,
    ]);

    logger.info('Charity added', { id, name: charity.name });

    return this.mapCharityRow(rows[0]);
  }

  /**
   * Update charity vetting status
   */
  async updateVettingStatus(
    id: string,
    status: 'approved' | 'rejected' | 'suspended',
    notes: string,
    approvedBy: string
  ): Promise<void> {
    const sql = `
      UPDATE charity_partners
      SET
        vetting_status = $2,
        vetting_date = CURRENT_DATE,
        vetting_notes = $3,
        is_active = $4,
        updated_at = NOW()
      WHERE id = $1
    `;

    await query(sql, [id, status, notes, status === 'approved']);

    logger.info('Charity vetting status updated', { id, status, approvedBy });
  }

  /**
   * Update charity allocation percentages
   * Must sum to 100 across all active charities
   */
  async updateAllocations(
    allocations: Array<{ charityId: string; percentage: number }>
  ): Promise<void> {
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Allocation percentages must sum to 100');
    }

    await transaction(async (client) => {
      // Reset all allocations first
      await client.query(
        'UPDATE charity_partners SET allocation_percentage = 0'
      );

      // Set new allocations
      for (const { charityId, percentage } of allocations) {
        await client.query(
          `UPDATE charity_partners
           SET allocation_percentage = $2, updated_at = NOW()
           WHERE id = $1`,
          [charityId, percentage]
        );
      }
    });

    logger.info('Charity allocations updated', { allocations });
  }

  /**
   * Get donation summary for transparency dashboard
   */
  async getDonationSummary(): Promise<CharityDonationSummary[]> {
    const sql = `
      SELECT
        cp.id,
        cp.name,
        cp.logo_url,
        cp.allocation_percentage,
        COALESCE(SUM(d.net_amount), 0) as total_donated,
        MAX(d.confirmed_at) as last_donation
      FROM charity_partners cp
      LEFT JOIN disbursements d ON d.charity_id = cp.id AND d.status = 'confirmed'
      WHERE cp.is_active = true
      GROUP BY cp.id, cp.name, cp.logo_url, cp.allocation_percentage
      ORDER BY total_donated DESC
    `;

    const { rows } = await query<any>(sql);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      logoUrl: row.logo_url,
      totalDonated: parseFloat(row.total_donated),
      allocationPercentage: parseFloat(row.allocation_percentage),
      lastDonation: row.last_donation ? new Date(row.last_donation) : undefined,
    }));
  }

  /**
   * Create monthly disbursements for all active charities
   */
  async createMonthlyDisbursements(period: string): Promise<Disbursement[]> {
    const revenue = await microsoftAdsService.calculateDisbursementAmount(period);

    if (!revenue.verified) {
      throw new Error('Revenue records for this period are not fully verified');
    }

    if (revenue.netRevenue < config.minimumDisbursementAmount) {
      logger.info('Revenue below minimum disbursement threshold', {
        period,
        netRevenue: revenue.netRevenue,
        minimum: config.minimumDisbursementAmount,
      });
      return [];
    }

    const charities = await this.getActiveCharities();
    const disbursements: Disbursement[] = [];

    await transaction(async (client) => {
      for (const charity of charities) {
        if (charity.allocationPercentage <= 0) continue;

        const calculatedAmount = revenue.netRevenue * (charity.allocationPercentage / 100);
        const fees = this.estimateTransferFees(calculatedAmount, 'wire');
        const netAmount = calculatedAmount - fees;

        const id = uuidv4();

        const sql = `
          INSERT INTO disbursements (
            id, charity_id, disbursement_period,
            gross_revenue, allocation_percentage, calculated_amount,
            fees_deducted, net_amount, currency, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', 'pending')
          RETURNING *
        `;

        const { rows } = await client.query(sql, [
          id,
          charity.id,
          period,
          revenue.grossRevenue,
          charity.allocationPercentage,
          calculatedAmount,
          fees,
          netAmount,
        ]);

        disbursements.push(this.mapDisbursementRow(rows[0]));
      }
    });

    logger.info('Monthly disbursements created', {
      period,
      count: disbursements.length,
      totalAmount: disbursements.reduce((sum, d) => sum + d.netAmount, 0),
    });

    return disbursements;
  }

  /**
   * Approve a disbursement for processing
   */
  async approveDisbursement(id: string, approvedBy: string): Promise<void> {
    const sql = `
      UPDATE disbursements
      SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
    `;

    const { rowCount } = await query(sql, [id, approvedBy]);

    if (rowCount === 0) {
      throw new Error('Disbursement not found or not in pending status');
    }

    logger.info('Disbursement approved', { id, approvedBy });
  }

  /**
   * Mark disbursement as sent
   */
  async markDisbursementSent(
    id: string,
    transferReference: string,
    transferMethod: 'wire' | 'ach' | 'paypal'
  ): Promise<void> {
    const sql = `
      UPDATE disbursements
      SET
        status = 'sent',
        sent_at = NOW(),
        transfer_reference = $2,
        transfer_method = $3,
        updated_at = NOW()
      WHERE id = $1 AND status IN ('approved', 'processing')
    `;

    const { rowCount } = await query(sql, [id, transferReference, transferMethod]);

    if (rowCount === 0) {
      throw new Error('Disbursement not found or not in valid status');
    }

    logger.info('Disbursement marked as sent', { id, transferReference });
  }

  /**
   * Upload donation receipt
   */
  async uploadReceipt(
    disbursementId: string,
    receiptData: {
      receiptNumber?: string;
      receiptDate?: Date;
      receivedAmount: number;
      fileUrl: string;
      fileHash: string;
      fileType?: string;
      fileSizeBytes?: number;
    }
  ): Promise<DonationReceipt> {
    const id = uuidv4();

    const sql = `
      INSERT INTO donation_receipts (
        id, disbursement_id, receipt_number, receipt_date,
        received_amount, currency, file_url, file_hash,
        file_type, file_size_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7, $8, $9)
      RETURNING *
    `;

    const { rows } = await query<any>(sql, [
      id,
      disbursementId,
      receiptData.receiptNumber,
      receiptData.receiptDate,
      receiptData.receivedAmount,
      receiptData.fileUrl,
      receiptData.fileHash,
      receiptData.fileType,
      receiptData.fileSizeBytes,
    ]);

    // Update disbursement status
    await query(
      `UPDATE disbursements SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
      [disbursementId]
    );

    logger.info('Receipt uploaded and disbursement confirmed', {
      receiptId: id,
      disbursementId,
    });

    return this.mapReceiptRow(rows[0]);
  }

  /**
   * Get recent disbursements for transparency
   */
  async getRecentDisbursements(limit: number = 10): Promise<DisbursementSummary[]> {
    const sql = `
      SELECT
        d.id,
        cp.name as charity_name,
        d.disbursement_period as period,
        d.net_amount as amount,
        d.status,
        dr.file_url as receipt_url
      FROM disbursements d
      JOIN charity_partners cp ON cp.id = d.charity_id
      LEFT JOIN donation_receipts dr ON dr.disbursement_id = d.id
      ORDER BY d.created_at DESC
      LIMIT $1
    `;

    const { rows } = await query<any>(sql, [limit]);

    return rows.map((row) => ({
      id: row.id,
      charityName: row.charity_name,
      period: row.period,
      amount: parseFloat(row.amount),
      status: row.status,
      receiptUrl: row.receipt_url,
    }));
  }

  /**
   * Estimate wire transfer fees
   */
  private estimateTransferFees(amount: number, method: string): number {
    const feeRates: Record<string, { flat: number; percentage: number }> = {
      wire: { flat: 25, percentage: 0 },
      ach: { flat: 0, percentage: 0.01 },
      paypal: { flat: 0, percentage: 0.029 },
    };

    const rate = feeRates[method] || feeRates.wire;
    return rate.flat + amount * rate.percentage;
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: Buffer): string {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  private mapCharityRow(row: any): CharityPartner {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legal_name,
      registrationNumber: row.registration_number,
      country: row.country,
      description: row.description,
      websiteUrl: row.website_url,
      logoUrl: row.logo_url,
      vettingStatus: row.vetting_status,
      vettingDate: row.vetting_date ? new Date(row.vetting_date) : undefined,
      vettingNotes: row.vetting_notes,
      watchlistCheckDate: row.watchlist_check_date
        ? new Date(row.watchlist_check_date)
        : undefined,
      watchlistClear: row.watchlist_clear,
      allocationPercentage: parseFloat(row.allocation_percentage),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDisbursementRow(row: any): Disbursement {
    return {
      id: row.id,
      charityId: row.charity_id,
      disbursementPeriod: row.disbursement_period,
      grossRevenue: parseFloat(row.gross_revenue),
      allocationPercentage: parseFloat(row.allocation_percentage),
      calculatedAmount: parseFloat(row.calculated_amount),
      feesDeducted: parseFloat(row.fees_deducted),
      netAmount: parseFloat(row.net_amount),
      currency: row.currency,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
      transferReference: row.transfer_reference,
      transferMethod: row.transfer_method,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapReceiptRow(row: any): DonationReceipt {
    return {
      id: row.id,
      disbursementId: row.disbursement_id,
      receiptNumber: row.receipt_number,
      receiptDate: row.receipt_date ? new Date(row.receipt_date) : undefined,
      receivedAmount: parseFloat(row.received_amount),
      currency: row.currency,
      fileUrl: row.file_url,
      fileHash: row.file_hash,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      verified: row.verified,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      verificationNotes: row.verification_notes,
      uploadedAt: new Date(row.uploaded_at),
    };
  }
}

export const charityService = new CharityService();
