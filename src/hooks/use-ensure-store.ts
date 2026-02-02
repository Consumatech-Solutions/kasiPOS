'use client';

import { useState } from 'react';
import { useSettings } from '@/components/settings-provider';
import { storesApi } from '@/lib/api/stores';
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
import { saveStorePermanently, loadStoreFromIndexedDB } from '@/lib/store-persistence';
import type { Store } from '@/types';

export function useEnsureStore() {
  const { settings, setSetting } = useSettings();
  const [isLoading, setIsLoading] = useState(false);

  const ensureStore = async (): Promise<Store | null> => {
    // If store already exists, return it immediately
    if (settings.currentStore) {
      return settings.currentStore;
    }

    // If we're offline, try loading from IndexedDB
    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log('[useEnsureStore] Offline - attempting to load store from IndexedDB');
      const cachedStore = await loadStoreFromIndexedDB(settings.currentUser?.storeId);
      if (cachedStore) {
        setSetting('currentStore', cachedStore);
        return cachedStore;
      }
      feedback.error('Offline', 'Cannot fetch store while offline.', 'Check your connection and try again.', { code: ERROR_CODES.STORE });
      return null;
    }

    setIsLoading(true);
    try {
      const response = await storesApi.getMyStore();
      const store = response.data;
      
      // Save store permanently to both localStorage and IndexedDB
      await saveStorePermanently(store, setSetting);
      
      setIsLoading(false);
      return store;
    } catch (error: unknown) {
      setIsLoading(false);
      
      // If network error, try loading from IndexedDB
      const err = error as { code?: string; message?: string };
      if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        console.log('[useEnsureStore] Network error - attempting to load store from IndexedDB');
        const cachedStore = await loadStoreFromIndexedDB(settings.currentUser?.storeId);
        if (cachedStore) {
          setSetting('currentStore', cachedStore);
          feedback.success('Using cached store', 'Loaded store from offline cache.');
          return cachedStore;
        }
      }
      feedback.fromError(error, 'Failed to load store', 'Check your connection and try again.', ERROR_CODES.STORE);
      return null;
    }
  };

  return {
    ensureStore,
    currentStore: settings.currentStore,
    isLoading,
  };
}

