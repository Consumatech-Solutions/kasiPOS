'use client';

import { useState, useEffect, useCallback } from 'react';
import { marketplaceStoresApi, type MarketplaceStore } from '@/lib/api/marketplace-stores';

interface UseMarketplaceStoresOptions {
  activeOnly?: boolean;
  autoLoad?: boolean;
}

export function useMarketplaceStores(options: UseMarketplaceStoresOptions = {}) {
  const { activeOnly = true, autoLoad = true } = options;

  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await marketplaceStoresApi.getAll(activeOnly);
      setStores(response.data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load marketplace stores';
      setError(errorMessage);
      console.error('Error loading marketplace stores:', err);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (autoLoad) {
      loadStores();
    }
  }, [autoLoad, loadStores]);

  return {
    stores,
    loading,
    error,
    refresh: loadStores,
    loadStores,
  };
}
