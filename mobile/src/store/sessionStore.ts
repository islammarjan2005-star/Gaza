import { create } from 'zustand';
import { api } from '../services/api';
import * as SecureStore from 'expo-secure-store';

interface SessionState {
  sessionToken: string | null;
  searchCount: number;
  isInitialized: boolean;

  // Actions
  initSession: () => Promise<void>;
  incrementSearchCount: () => void;
  getSearchCount: () => Promise<number>;
}

const SEARCH_COUNT_KEY = 'search_count';

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionToken: null,
  searchCount: 0,
  isInitialized: false,

  initSession: async () => {
    try {
      const token = await api.initSession();

      // Load persisted search count
      let count = 0;
      try {
        const storedCount = await SecureStore.getItemAsync(SEARCH_COUNT_KEY);
        if (storedCount) {
          count = parseInt(storedCount, 10);
        }
      } catch {
        // Fallback if SecureStore not available
      }

      set({
        sessionToken: token,
        searchCount: count,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize session:', error);
      set({ isInitialized: true });
    }
  },

  incrementSearchCount: async () => {
    const newCount = get().searchCount + 1;
    set({ searchCount: newCount });

    try {
      await SecureStore.setItemAsync(SEARCH_COUNT_KEY, String(newCount));
    } catch {
      // Silently fail
    }
  },

  getSearchCount: async () => {
    try {
      const storedCount = await SecureStore.getItemAsync(SEARCH_COUNT_KEY);
      return storedCount ? parseInt(storedCount, 10) : 0;
    } catch {
      return get().searchCount;
    }
  },
}));
