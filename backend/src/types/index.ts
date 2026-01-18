// Core types for Ecosia-for-Gaza backend

export interface SearchSession {
  id: string;
  sessionToken: string;
  queryHash: string;
  queryCategory?: string;
  resultCount: number;
  adCount: number;
  responseTimeMs?: number;
  deviceType: 'ios' | 'android' | 'web';
  countryCode?: string;
  safeSearchLevel: 'off' | 'moderate' | 'strict';
  createdAt: Date;
}

export interface AdImpression {
  id: string;
  sessionId: string;
  adId: string;
  adPosition: number;
  adType: 'sponsored_link' | 'sidebar' | 'mainline';
  advertiserDomain?: string;
  estimatedCpm?: number;
  isBrandSafe: boolean;
  contentCategory?: string;
  impressionTimestamp: Date;
}

export interface AdClick {
  id: string;
  impressionId: string;
  sessionId: string;
  clickTimestamp: Date;
  clickPosition?: number;
  estimatedCpc?: number;
  actualRevenue?: number;
  revenueConfirmed: boolean;
  confirmationDate?: Date;
}

export interface DailyMetrics {
  id: string;
  metricDate: Date;
  totalSearches: number;
  totalImpressions: number;
  totalClicks: number;
  estimatedRevenue: number;
  confirmedRevenue?: number;
  uniqueDevices?: number;
  avgResponseTimeMs?: number;
  topCategories?: Record<string, number>;
  countryBreakdown?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueRecord {
  id: string;
  reportDate: Date;
  reportType: 'daily' | 'weekly' | 'monthly';
  microsoftReportId?: string;
  grossRevenue: number;
  microsoftShare: number;
  ourShare: number;
  clickCount: number;
  impressionCount: number;
  averageCpc?: number;
  averageCpm?: number;
  currency: string;
  rawReportData?: Record<string, unknown>;
  fetchedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface CharityPartner {
  id: string;
  name: string;
  legalName: string;
  registrationNumber?: string;
  country: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  vettingStatus: 'pending' | 'approved' | 'suspended' | 'rejected';
  vettingDate?: Date;
  vettingNotes?: string;
  watchlistCheckDate?: Date;
  watchlistClear: boolean;
  allocationPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Disbursement {
  id: string;
  charityId: string;
  disbursementPeriod: string;
  grossRevenue: number;
  allocationPercentage: number;
  calculatedAmount: number;
  feesDeducted: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'approved' | 'processing' | 'sent' | 'confirmed' | 'failed';
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  confirmedAt?: Date;
  transferReference?: string;
  transferMethod?: 'wire' | 'ach' | 'paypal';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DonationReceipt {
  id: string;
  disbursementId: string;
  receiptNumber?: string;
  receiptDate?: Date;
  receivedAmount: number;
  currency: string;
  fileUrl: string;
  fileHash: string;
  fileType?: string;
  fileSizeBytes?: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  uploadedAt: Date;
}

export interface BlockedAdvertiser {
  id: string;
  domain: string;
  reason: 'political' | 'adult' | 'gambling' | 'weapons' | 'other';
  description?: string;
  blockedAt: Date;
  blockedBy?: string;
  isActive: boolean;
}

// Bing API Types
export interface BingSearchResult {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
  dateLastCrawled?: string;
  cachedPageUrl?: string;
  language?: string;
  isFamilyFriendly?: boolean;
  isNavigational?: boolean;
}

export interface BingSearchResponse {
  _type: string;
  queryContext: {
    originalQuery: string;
    alteredQuery?: string;
    alterationDisplayQuery?: string;
  };
  webPages?: {
    webSearchUrl: string;
    totalEstimatedMatches: number;
    value: BingSearchResult[];
  };
  ads?: BingAdResult[];
  relatedSearches?: {
    value: Array<{ text: string; displayText: string; webSearchUrl: string }>;
  };
}

export interface BingAdResult {
  id: string;
  title: string;
  displayUrl: string;
  destinationUrl: string;
  description: string;
  position: number;
  adType: string;
  advertiserName?: string;
}

// API Request/Response Types
export interface SearchRequest {
  query: string;
  count?: number;
  offset?: number;
  market?: string;
  safeSearch?: 'off' | 'moderate' | 'strict';
  freshness?: 'Day' | 'Week' | 'Month';
  sessionToken: string;
  deviceType: 'ios' | 'android' | 'web';
}

export interface SearchResponse {
  sessionId: string;
  query: string;
  results: BingSearchResult[];
  ads: ProcessedAd[];
  totalResults: number;
  relatedSearches: string[];
  responseTimeMs: number;
}

export interface ProcessedAd {
  id: string;
  title: string;
  displayUrl: string;
  clickUrl: string;
  description: string;
  position: number;
  impressionId: string;
}

export interface AdClickRequest {
  impressionId: string;
  sessionId: string;
  position: number;
}

export interface TransparencyData {
  totalDonated: number;
  totalSearches: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  charities: CharityDonationSummary[];
  recentDisbursements: DisbursementSummary[];
}

export interface CharityDonationSummary {
  id: string;
  name: string;
  logoUrl?: string;
  totalDonated: number;
  allocationPercentage: number;
  lastDonation?: Date;
}

export interface DisbursementSummary {
  id: string;
  charityName: string;
  period: string;
  amount: number;
  status: string;
  receiptUrl?: string;
}

// Revenue Report Types
export interface MicrosoftAdsReportRow {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  revenue: number;
  cpc: number;
  cpm: number;
}

export interface RevenueAggregation {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  grossRevenue: number;
  netRevenue: number;
  totalClicks: number;
  totalImpressions: number;
  averageCpc: number;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  actor: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'send';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
