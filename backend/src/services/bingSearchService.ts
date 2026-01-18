import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cacheGet, cacheSet } from '../config/redis';
import {
  BingSearchResponse,
  BingSearchResult,
  BingAdResult,
  SearchRequest,
  SearchResponse,
  ProcessedAd,
} from '../types';
import { AdTrackingService } from './adTrackingService';
import { ContentFilterService } from './contentFilterService';
import { v4 as uuidv4 } from 'uuid';

export class BingSearchService {
  private client: AxiosInstance;
  private adTracker: AdTrackingService;
  private contentFilter: ContentFilterService;

  constructor() {
    this.client = axios.create({
      baseURL: config.bingSearchEndpoint,
      headers: {
        'Ocp-Apim-Subscription-Key': config.bingSearchApiKey,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
      },
      timeout: 10000,
    });

    this.adTracker = new AdTrackingService();
    this.contentFilter = new ContentFilterService();
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    const sessionId = uuidv4();
    const queryHash = this.hashQuery(request.query);

    // Check cache for popular queries
    const cacheKey = `search:${queryHash}:${request.safeSearch}:${request.market}`;
    const cached = await cacheGet<BingSearchResponse>(cacheKey);

    let bingResponse: BingSearchResponse;

    if (cached) {
      logger.debug('Search cache hit', { query: request.query });
      bingResponse = cached;
    } else {
      bingResponse = await this.fetchFromBing(request);

      // Cache for 5 minutes
      await cacheSet(cacheKey, bingResponse, 300);
    }

    // Process and filter results
    const filteredResults = await this.filterResults(
      bingResponse.webPages?.value || []
    );

    // Process ads with impression tracking
    const processedAds = await this.processAds(
      bingResponse.ads || [],
      sessionId,
      request
    );

    const responseTimeMs = Date.now() - startTime;

    // Record session
    await this.adTracker.recordSession({
      id: sessionId,
      sessionToken: request.sessionToken,
      queryHash,
      queryCategory: this.categorizeQuery(request.query),
      resultCount: filteredResults.length,
      adCount: processedAds.length,
      responseTimeMs,
      deviceType: request.deviceType,
      countryCode: this.extractCountry(request.market),
      safeSearchLevel: request.safeSearch || 'moderate',
      createdAt: new Date(),
    });

    return {
      sessionId,
      query: request.query,
      results: filteredResults,
      ads: processedAds,
      totalResults: bingResponse.webPages?.totalEstimatedMatches || 0,
      relatedSearches:
        bingResponse.relatedSearches?.value.map((r) => r.text) || [],
      responseTimeMs,
    };
  }

  private async fetchFromBing(request: SearchRequest): Promise<BingSearchResponse> {
    try {
      const params: Record<string, string | number> = {
        q: request.query,
        count: request.count || 10,
        offset: request.offset || 0,
        mkt: request.market || 'en-US',
        safeSearch: request.safeSearch || 'Moderate',
        textDecorations: 'true',
        textFormat: 'HTML',
        responseFilter: 'Webpages,Ads,RelatedSearches',
      };

      if (request.freshness) {
        params.freshness = request.freshness;
      }

      // Add custom config for ad serving if configured
      if (config.bingCustomConfigId) {
        params.customConfig = config.bingCustomConfigId;
      }

      const response = await this.client.get('', { params });

      logger.info('Bing search completed', {
        query: request.query,
        resultCount: response.data.webPages?.value?.length || 0,
        adCount: response.data.ads?.length || 0,
      });

      return response.data;
    } catch (error) {
      logger.error('Bing search failed', {
        query: request.query,
        error: (error as Error).message,
      });
      throw new Error('Search service temporarily unavailable');
    }
  }

  private async filterResults(
    results: BingSearchResult[]
  ): Promise<BingSearchResult[]> {
    const filtered: BingSearchResult[] = [];

    for (const result of results) {
      const isAllowed = await this.contentFilter.isContentAllowed(
        result.url,
        result.snippet
      );

      if (isAllowed) {
        filtered.push(result);
      }
    }

    return filtered;
  }

  private async processAds(
    ads: BingAdResult[],
    sessionId: string,
    request: SearchRequest
  ): Promise<ProcessedAd[]> {
    const processedAds: ProcessedAd[] = [];

    for (const ad of ads) {
      // Check if advertiser is blocked
      const isBlocked = await this.contentFilter.isAdvertiserBlocked(
        ad.advertiserName || this.extractDomain(ad.destinationUrl)
      );

      if (isBlocked) {
        logger.debug('Ad blocked', {
          advertiser: ad.advertiserName,
          reason: 'blocked_advertiser',
        });
        continue;
      }

      // Check content category
      const category = await this.contentFilter.getAdCategory(ad);
      const isCategoryBlocked = await this.contentFilter.isCategoryBlocked(category);

      if (isCategoryBlocked) {
        logger.debug('Ad blocked', {
          category,
          reason: 'blocked_category',
        });
        continue;
      }

      // Record impression
      const impressionId = await this.adTracker.recordImpression({
        id: uuidv4(),
        sessionId,
        adId: ad.id,
        adPosition: ad.position,
        adType: this.mapAdType(ad.adType),
        advertiserDomain: this.extractDomain(ad.destinationUrl),
        isBrandSafe: true,
        contentCategory: category,
        impressionTimestamp: new Date(),
      });

      processedAds.push({
        id: ad.id,
        title: ad.title,
        displayUrl: ad.displayUrl,
        clickUrl: this.buildClickTrackingUrl(impressionId, ad.destinationUrl),
        description: ad.description,
        position: ad.position,
        impressionId,
      });
    }

    return processedAds;
  }

  private buildClickTrackingUrl(impressionId: string, destinationUrl: string): string {
    // Build URL that routes through our click tracking endpoint
    const trackingUrl = new URL('/api/v1/ads/click', 'https://api.ecosia-for-gaza.org');
    trackingUrl.searchParams.set('imp', impressionId);
    trackingUrl.searchParams.set('dest', Buffer.from(destinationUrl).toString('base64'));
    return trackingUrl.toString();
  }

  private hashQuery(query: string): string {
    return crypto
      .createHash('sha256')
      .update(query.toLowerCase().trim())
      .digest('hex');
  }

  private categorizeQuery(query: string): string {
    // Simple query categorization
    const lowerQuery = query.toLowerCase();

    const categories: Record<string, string[]> = {
      shopping: ['buy', 'price', 'cheap', 'deal', 'sale', 'discount', 'store'],
      news: ['news', 'latest', 'today', 'breaking', 'update'],
      tech: ['how to', 'tutorial', 'software', 'app', 'computer', 'phone'],
      health: ['health', 'medical', 'doctor', 'symptom', 'treatment'],
      entertainment: ['movie', 'music', 'game', 'watch', 'stream'],
      travel: ['flight', 'hotel', 'travel', 'vacation', 'booking'],
      education: ['learn', 'course', 'study', 'university', 'school'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => lowerQuery.includes(kw))) {
        return category;
      }
    }

    return 'general';
  }

  private extractCountry(market?: string): string | undefined {
    if (!market) return undefined;
    const parts = market.split('-');
    return parts[1]?.toUpperCase();
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  private mapAdType(bingAdType: string): 'sponsored_link' | 'sidebar' | 'mainline' {
    switch (bingAdType?.toLowerCase()) {
      case 'sidebar':
        return 'sidebar';
      case 'mainline':
        return 'mainline';
      default:
        return 'sponsored_link';
    }
  }
}

export const bingSearchService = new BingSearchService();
