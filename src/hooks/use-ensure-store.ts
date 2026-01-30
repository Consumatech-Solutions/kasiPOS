'use client';

import { useState } from 'react';
import { useSettings } from '@/components/settings-provider';
import { storesApi } from '@/lib/api/stores';
import { useToast } from '@/hooks/use-toast';
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

    // If we're offline, return null (can't fetch)
    if (typeof window !== 'undefined' && !navigator.onLine) {
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
      setSetting('currentStore', store);
      setIsLoading(false);
      return store;
    } catch (error: any) {
      setIsLoading(false);
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

