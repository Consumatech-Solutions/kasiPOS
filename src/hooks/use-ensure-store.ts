'use client';

import { useState } from 'react';
import { useSettings } from '@/components/settings-provider';
import { storesApi } from '@/lib/api/stores';
import { useToast } from '@/hooks/use-toast';
import { saveStorePermanently, loadStoreFromIndexedDB } from '@/lib/store-persistence';
import type { Store } from '@/types';

export function useEnsureStore() {
  const { settings, setSetting } = useSettings();
  const { toast } = useToast();
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
      toast({
        variant: 'destructive',
        title: 'Offline',
        description: 'Cannot fetch store while offline. Please check your connection.',
      });
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
    } catch (error: any) {
      setIsLoading(false);
      
      // If network error, try loading from IndexedDB
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.log('[useEnsureStore] Network error - attempting to load store from IndexedDB');
        const cachedStore = await loadStoreFromIndexedDB(settings.currentUser?.storeId);
        if (cachedStore) {
          setSetting('currentStore', cachedStore);
          toast({
            title: 'Using Cached Store',
            description: 'Loaded store from offline cache.',
          });
          return cachedStore;
        }
      }
      
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to fetch store.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
      return null;
    }
  };

  return {
    ensureStore,
    currentStore: settings.currentStore,
    isLoading,
  };
}

