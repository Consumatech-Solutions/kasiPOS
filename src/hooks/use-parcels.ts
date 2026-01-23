'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { parcelsApi, type GetParcelsParams, type Parcel } from '@/lib/api/parcels';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseParcelsOptions extends GetParcelsParams {
  autoLoad?: boolean;
}

export function useParcels(options: UseParcelsOptions = {}) {
  const { autoLoad = true, ...params } = options;

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store latest params to avoid dependency issues
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const loadParcels = useCallback(async (loadParams?: GetParcelsParams) => {
    try {
      setLoading(true);
      setError(null);

      // Use ref to get latest params
      const requestParams = { ...paramsRef.current, ...loadParams };
      const response = await parcelsApi.getAll(requestParams);

      const responseData = response.data;
      if (Array.isArray(responseData)) {
        setParcels(responseData);
        setPagination({
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        });
      } else {
        setParcels(responseData.data);
        setPagination(responseData.meta);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load parcels';
      setError(errorMessage);
      console.error('Error loading parcels:', err);
      setParcels([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - use ref for params

  useEffect(() => {
    if (autoLoad) {
      loadParcels();
    }
  }, [autoLoad, loadParcels]);

  const createParcel = useCallback(async (data: Parameters<typeof parcelsApi.create>[0]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await parcelsApi.create(data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create parcel';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const receiveParcel = useCallback(async (id: string, data: Parameters<typeof parcelsApi.receive>[1]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await parcelsApi.receive(id, data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to receive parcel';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const collectParcel = useCallback(async (id: string, data: Parameters<typeof parcelsApi.collect>[1]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await parcelsApi.collect(id, data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to collect parcel';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateParcel = useCallback(async (id: string, data: Parameters<typeof parcelsApi.update>[1]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await parcelsApi.update(id, data);
      await loadParcels(); // Refresh the list after update
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to update parcel';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadParcels]);

  const deleteParcel = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await parcelsApi.delete(id);
      await loadParcels(); // Refresh the list after delete
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to delete parcel';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadParcels]);

  return {
    parcels,
    pagination,
    loading,
    error,
    refresh: loadParcels,
    loadParcels,
    createParcel,
    receiveParcel,
    collectParcel,
    updateParcel,
    deleteParcel,
  };
}
