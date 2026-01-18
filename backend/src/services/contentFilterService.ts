import { query } from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';
import { BingAdResult } from '../types';

interface BlockedCategory {
  categoryCode: string;
  categoryName: string;
  reason: string;
}

interface BlockedAdvertiser {
  domain: string;
  reason: string;
}

export class ContentFilterService {
  private blockedDomains: Set<string> = new Set();
  private blockedCategories: Set<string> = new Set();
  private initialized = false;

  // Political and sensitive keywords to filter
  private politicalKeywords = [
    'election', 'vote', 'candidate', 'political party',
    'democrat', 'republican', 'conservative', 'liberal',
    'protest', 'rally', 'campaign', 'ballot',
    'congress', 'senate', 'legislation',
  ];

  // Categories that should be blocked
  private blockedCategoryKeywords: Record<string, string[]> = {
    POL_ADV: ['political', 'campaign', 'vote for', 'elect'],
    POL_ORG: ['pac', 'super pac', 'political action'],
    WEAPONS: ['gun', 'firearm', 'ammunition', 'weapon'],
    GAMBLING: ['casino', 'betting', 'poker', 'gambling'],
    ADULT: ['adult', 'xxx', 'nsfw'],
    TOBACCO: ['cigarette', 'vape', 'tobacco', 'e-cig'],
    CRYPTO: ['bitcoin', 'cryptocurrency', 'crypto trading', 'nft'],
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadBlockedDomains();
    await this.loadBlockedCategories();
    this.initialized = true;

    logger.info('Content filter initialized', {
      blockedDomains: this.blockedDomains.size,
      blockedCategories: this.blockedCategories.size,
    });
  }

  private async loadBlockedDomains(): Promise<void> {
    const cached = await cacheGet<string[]>('filter:blocked_domains');

    if (cached) {
      this.blockedDomains = new Set(cached);
      return;
    }

    const sql = `
      SELECT domain FROM blocked_advertisers WHERE is_active = true
    `;

    const { rows } = await query<{ domain: string }>(sql);
    const domains = rows.map((r) => r.domain.toLowerCase());

    this.blockedDomains = new Set(domains);
    await cacheSet('filter:blocked_domains', domains, 3600); // Cache for 1 hour
  }

  private async loadBlockedCategories(): Promise<void> {
    const cached = await cacheGet<string[]>('filter:blocked_categories');

    if (cached) {
      this.blockedCategories = new Set(cached);
      return;
    }

    const sql = `
      SELECT category_code FROM content_categories_blocked
    `;

    const { rows } = await query<{ category_code: string }>(sql);
    const categories = rows.map((r) => r.category_code);

    this.blockedCategories = new Set(categories);
    await cacheSet('filter:blocked_categories', categories, 3600);
  }

  /**
   * Check if content URL and text are allowed
   */
  async isContentAllowed(url: string, text: string): Promise<boolean> {
    await this.initialize();

    const domain = this.extractDomain(url).toLowerCase();

    // Check blocked domains
    if (this.blockedDomains.has(domain)) {
      return false;
    }

    // Check for adult content
    if (this.containsAdultContent(text)) {
      return false;
    }

    return true;
  }

  /**
   * Check if advertiser domain is blocked
   */
  async isAdvertiserBlocked(advertiserDomain: string): Promise<boolean> {
    await this.initialize();

    const domain = advertiserDomain.toLowerCase();
    return this.blockedDomains.has(domain);
  }

  /**
   * Determine ad category from content
   */
  async getAdCategory(ad: BingAdResult): Promise<string> {
    const text = `${ad.title} ${ad.description}`.toLowerCase();

    for (const [category, keywords] of Object.entries(this.blockedCategoryKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        return category;
      }
    }

    // Check for political content
    if (this.containsPoliticalContent(text)) {
      return 'POL_ADV';
    }

    return 'GENERAL';
  }

  /**
   * Check if a category is blocked
   */
  async isCategoryBlocked(category: string): Promise<boolean> {
    await this.initialize();
    return this.blockedCategories.has(category);
  }

  /**
   * Add a domain to the blocked list
   */
  async blockDomain(
    domain: string,
    reason: string,
    blockedBy: string
  ): Promise<void> {
    const sql = `
      INSERT INTO blocked_advertisers (domain, reason, blocked_by, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (domain) DO UPDATE SET
        reason = EXCLUDED.reason,
        blocked_by = EXCLUDED.blocked_by,
        is_active = true,
        blocked_at = NOW()
    `;

    await query(sql, [domain.toLowerCase(), reason, blockedBy]);
    this.blockedDomains.add(domain.toLowerCase());

    // Invalidate cache
    await cacheSet('filter:blocked_domains', Array.from(this.blockedDomains), 3600);

    logger.info('Domain blocked', { domain, reason, blockedBy });
  }

  /**
   * Remove a domain from the blocked list
   */
  async unblockDomain(domain: string): Promise<void> {
    const sql = `
      UPDATE blocked_advertisers SET is_active = false WHERE domain = $1
    `;

    await query(sql, [domain.toLowerCase()]);
    this.blockedDomains.delete(domain.toLowerCase());

    // Invalidate cache
    await cacheSet('filter:blocked_domains', Array.from(this.blockedDomains), 3600);

    logger.info('Domain unblocked', { domain });
  }

  /**
   * Get all blocked domains
   */
  async getBlockedDomains(): Promise<BlockedAdvertiser[]> {
    const sql = `
      SELECT domain, reason
      FROM blocked_advertisers
      WHERE is_active = true
      ORDER BY blocked_at DESC
    `;

    const { rows } = await query<BlockedAdvertiser>(sql);
    return rows;
  }

  /**
   * Check for political content
   */
  private containsPoliticalContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.politicalKeywords.some((kw) => lowerText.includes(kw));
  }

  /**
   * Check for adult content
   */
  private containsAdultContent(text: string): boolean {
    const adultPatterns = [
      /\bxxx\b/i,
      /\bporn/i,
      /\badult\s*content/i,
      /\bnsfw\b/i,
      /\bexplicit/i,
    ];

    return adultPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Validate ad content for brand safety
   */
  async validateAdForBrandSafety(ad: BingAdResult): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    const text = `${ad.title} ${ad.description}`.toLowerCase();

    // Check for political content
    if (this.containsPoliticalContent(text)) {
      return { isValid: false, reason: 'Political content detected' };
    }

    // Check for adult content
    if (this.containsAdultContent(text)) {
      return { isValid: false, reason: 'Adult content detected' };
    }

    // Check blocked advertiser
    const advertiserDomain = this.extractDomain(ad.destinationUrl);
    if (await this.isAdvertiserBlocked(advertiserDomain)) {
      return { isValid: false, reason: 'Blocked advertiser' };
    }

    return { isValid: true };
  }

  /**
   * Get list of blocked categories with descriptions
   */
  async getBlockedCategories(): Promise<BlockedCategory[]> {
    const sql = `
      SELECT category_code, category_name, reason
      FROM content_categories_blocked
      ORDER BY category_name
    `;

    const { rows } = await query<BlockedCategory>(sql);
    return rows;
  }
}

export const contentFilterService = new ContentFilterService();
