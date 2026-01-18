import { create } from 'zustand';
import { api } from '../services/api';

export interface SearchResult {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
}

export interface Ad {
  id: string;
  title: string;
  displayUrl: string;
  clickUrl: string;
  description: string;
  position: number;
  impressionId: string;
}

interface SearchResponse {
  sessionId: string;
  query: string;
  results: SearchResult[];
  ads: Ad[];
  totalResults: number;
  relatedSearches: string[];
  responseTimeMs: number;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  ads: Ad[];
  relatedSearches: string[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
  searchHistory: string[];

  // Actions
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  loadMore: () => Promise<void>;
  clearResults: () => void;
  addToHistory: (query: string) => void;
}

const MAX_HISTORY = 20;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  ads: [],
  relatedSearches: [],
  totalResults: 0,
  isLoading: false,
  error: null,
  searchHistory: [],

  setQuery: (query) => {
    set({ query });
  },

  search: async (query) => {
    if (!query.trim()) return;

    set({ isLoading: true, error: null, query });

    try {
      const response = await api.search(query);

      if (response.success) {
        const data: SearchResponse = response.data;

        set({
          results: data.results,
          ads: data.ads,
          relatedSearches: data.relatedSearches,
          totalResults: data.totalResults,
          isLoading: false,
        });

        // Add to history
        get().addToHistory(query);
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      set({
        error: (error as Error).message || 'Search failed',
        isLoading: false,
      });
    }
  },

  loadMore: async () => {
    const { query, results, isLoading, totalResults } = get();

    if (isLoading || results.length >= totalResults) return;

    set({ isLoading: true });

    try {
      const response = await api.search(query, {
        offset: results.length,
      });

      if (response.success) {
        const data: SearchResponse = response.data;

        set({
          results: [...results, ...data.results],
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  clearResults: () => {
    set({
      query: '',
      results: [],
      ads: [],
      relatedSearches: [],
      totalResults: 0,
      error: null,
    });
  },

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [
      query,
      ...searchHistory.filter((q) => q !== query),
    ].slice(0, MAX_HISTORY);

    set({ searchHistory: newHistory });
  },
}));
