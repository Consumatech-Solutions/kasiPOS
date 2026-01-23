'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { marketplaceOrdersApi, type GetMarketplaceOrdersParams, type MarketplaceOrder } from '@/lib/api/marketplace-orders';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseMarketplaceOrdersOptions extends GetMarketplaceOrdersParams {
  autoLoad?: boolean;
}

export function useMarketplaceOrders(options: UseMarketplaceOrdersOptions = {}) {
  const { autoLoad = true, ...params } = options;

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [foundOrder, setFoundOrder] = useState<MarketplaceOrder | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(autoLoad);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store latest params to avoid dependency issues
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const loadOrders = useCallback(async (loadParams?: GetMarketplaceOrdersParams) => {
    try {
      setLoading(true);
      setError(null);

      // Use ref to get latest params
      const requestParams = { ...paramsRef.current, ...loadParams };
      const response = await marketplaceOrdersApi.getAll(requestParams);

      const responseData = response.data;
      if (Array.isArray(responseData)) {
        setOrders(responseData);
        setPagination({
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        });
      } else {
        setOrders(responseData.data);
        setPagination(responseData.meta);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load marketplace orders';
      setError(errorMessage);
      console.error('Error loading marketplace orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - use ref for params

  useEffect(() => {
    if (autoLoad) {
      loadOrders();
    }
  }, [autoLoad, loadOrders]);

  const createOrder = useCallback(async (data: Parameters<typeof marketplaceOrdersApi.create>[0]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await marketplaceOrdersApi.create(data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create marketplace order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const findByOrderCode = useCallback(async (code: string) => {
    try {
      setSearchLoading(true);
      setError(null);
      const response = await marketplaceOrdersApi.findByOrderCode(code);
      setFoundOrder(response.data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Order not found';
      setError(errorMessage);
      setFoundOrder(null);
      throw err;
    } finally {
      setSearchLoading(false);
    }
  }, []);

  return {
    orders,
    foundOrder,
    pagination,
    loading,
    searchLoading,
    error,
    refresh: loadOrders,
    loadOrders,
    createOrder,
    findByOrderCode,
  };
}
