'use client';

import { useState, useEffect, useCallback } from 'react';
import { storesApi } from '@/lib/api/stores';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

export function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await storesApi.getMyStore();
      setStore(response.data);
    } catch (err: any) {
      // 404 means no store exists for this user
      if (err?.response?.status === 404) {
        setStore(null);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load store';
        setError(errorMessage);
        console.error('Error loading store:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const createStore = useCallback(async (data: CreateStoreDto) => {
    try {
      const response = await storesApi.create(data);
      const created = response.data;
      setStore(created);
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create store';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const updateStore = useCallback(async (id: number, data: UpdateStoreDto) => {
    try {
      if (!store) {
        throw new Error('No store to update');
      }

      const response = await storesApi.update(id, data);
      const updated = response.data;
      setStore(updated);
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update store';
      setError(errorMessage);
      throw err;
    }
  }, [store]);

  return {
    store,
    hasStore: !!store,
    loading,
    error,
    createStore,
    updateStore,
    refresh: loadStore,
  };
}
