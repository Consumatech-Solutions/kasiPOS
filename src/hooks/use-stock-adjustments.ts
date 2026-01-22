'use client';

import { useState, useEffect, useCallback } from 'react';
import { stockAdjustmentsApi, type CreateStockAdjustmentDto } from '@/lib/api/stock-adjustments';
import type { StockAdjustment } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseStockAdjustmentsOptions {
  productId?: string;
  initialPage?: number;
  initialLimit?: number;
}

export function useStockAdjustments(options: UseStockAdjustmentsOptions = {}) {
  const { productId, initialPage = 1, initialLimit = 10 } = options;

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: initialPage,
    limit: initialLimit,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response: { data: StockAdjustment[] | PaginatedResponse<StockAdjustment> };
      
      if (productId) {
        // Get adjustments for specific product
        response = await stockAdjustmentsApi.getByProduct(productId);
        setAdjustments(Array.isArray(response.data) ? response.data : []);
        setPagination({
          total: Array.isArray(response.data) ? response.data.length : 0,
          page: 1,
          limit: initialLimit,
          totalPages: 1,
        });
      } else {
        // Get all adjustments with pagination
        const params: any = { page: initialPage, limit: initialLimit };
        response = await stockAdjustmentsApi.getAll(params);

        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setAdjustments(responseData);
          setPagination({
            total: responseData.length,
            page: 1,
            limit: responseData.length,
            totalPages: 1,
          });
        } else {
          setAdjustments(responseData.data);
          setPagination(responseData.meta);
        }
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load stock adjustments';
      setError(errorMessage);
      console.error('Error loading stock adjustments:', err);
    } finally {
      setLoading(false);
    }
  }, [productId, initialPage, initialLimit]);

  useEffect(() => {
    loadAdjustments();
  }, [loadAdjustments]);

  const createAdjustment = useCallback(async (data: CreateStockAdjustmentDto) => {
    try {
      const response = await stockAdjustmentsApi.create(data);
      const created = response.data;

      // Refresh the list
      await loadAdjustments();

      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create stock adjustment';
      setError(errorMessage);
      throw err;
    }
  }, [loadAdjustments]);

  return {
    adjustments,
    pagination,
    loading,
    error,
    createAdjustment,
    refresh: loadAdjustments,
  };
}
