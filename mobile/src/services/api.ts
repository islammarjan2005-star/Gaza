import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://api.ecosia-for-gaza.org/api/v1';

const SESSION_TOKEN_KEY = 'session_token';

class ApiService {
  private client: AxiosInstance;
  private sessionToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add session token
    this.client.interceptors.request.use(async (config) => {
      if (this.sessionToken) {
        config.headers['X-Session-Token'] = this.sessionToken;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async initSession(): Promise<string> {
    try {
      // Try to get existing session token
      const existingToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

      if (existingToken) {
        this.sessionToken = existingToken;
        return existingToken;
      }

      // Generate new session token
      const newToken = this.generateSessionToken();
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, newToken);
      this.sessionToken = newToken;

      return newToken;
    } catch (error) {
      // Fallback for environments without secure store
      const fallbackToken = this.generateSessionToken();
      this.sessionToken = fallbackToken;
      return fallbackToken;
    }
  }

  private generateSessionToken(): string {
    const array = new Uint8Array(32);
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Search endpoints
  async search(query: string, options?: {
    count?: number;
    offset?: number;
    safeSearch?: 'off' | 'moderate' | 'strict';
  }) {
    const params = new URLSearchParams({
      q: query,
      count: String(options?.count || 10),
      offset: String(options?.offset || 0),
      safeSearch: options?.safeSearch || 'moderate',
    });

    const response = await this.client.get(`/search?${params}`);
    return response.data;
  }

  async getSuggestions(query: string) {
    const response = await this.client.get('/search/suggestions', {
      params: { q: query },
    });
    return response.data;
  }

  async getTrending() {
    const response = await this.client.get('/search/trending');
    return response.data;
  }

  // Ad tracking
  async reportImpression(impressionId: string, viewTime: number) {
    try {
      await this.client.post('/ads/impression', { impressionId, viewTime });
    } catch {
      // Silently fail - impression tracking is not critical
    }
  }

  // Transparency endpoints
  async getTransparencyData() {
    const response = await this.client.get('/transparency');
    return response.data;
  }

  async getLiveCounters() {
    const response = await this.client.get('/transparency/live');
    return response.data;
  }

  async getDailyMetrics(days: number = 30) {
    const response = await this.client.get('/transparency/metrics', {
      params: { days },
    });
    return response.data;
  }

  async calculateImpact(searchCount: number) {
    const response = await this.client.post('/transparency/impact', {
      searchCount,
    });
    return response.data;
  }

  async getCharityBreakdown() {
    const response = await this.client.get('/transparency/charities');
    return response.data;
  }

  async getMonthlyReport(period: string) {
    const response = await this.client.get(`/transparency/report/${period}`);
    return response.data;
  }

  // Charity endpoints
  async getCharities() {
    const response = await this.client.get('/charities');
    return response.data;
  }

  async getCharity(id: string) {
    const response = await this.client.get(`/charities/${id}`);
    return response.data;
  }

  async getDonationSummary() {
    const response = await this.client.get('/charities/donations');
    return response.data;
  }

  async getRecentDisbursements(limit: number = 10) {
    const response = await this.client.get('/charities/disbursements/recent', {
      params: { limit },
    });
    return response.data;
  }

  // Privacy endpoints
  async exportUserData() {
    const response = await this.client.get('/privacy/export');
    return response.data;
  }

  async deleteUserData() {
    const response = await this.client.delete('/privacy/data');
    return response.data;
  }
}

export const api = new ApiService();
