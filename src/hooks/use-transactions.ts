'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { transactionsApi, type GetTransactionsParams } from '@/lib/api/transactions';
import type { Transaction } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseTransactionsOptions extends GetTransactionsParams {
  autoLoad?: boolean;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { autoLoad = true, ...params } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  const loadTransactions = useCallback(async (loadParams?: GetTransactionsParams) => {
    try {
      setLoading(true);
      setError(null);

      // Use ref to get latest params
      const requestParams = { ...paramsRef.current, ...loadParams };
      const response = await transactionsApi.getAll(requestParams);

      const responseData = response.data;
      if (Array.isArray(responseData)) {
        setTransactions(responseData);
        setPagination({
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        });
      } else {
        setTransactions(responseData.data);
        setPagination(responseData.meta);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load transactions';
      setError(errorMessage);
      console.error('Error loading transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - use ref for params

  useEffect(() => {
    if (autoLoad) {
      loadTransactions();
    }
  }, [autoLoad, loadTransactions]);

  return {
    transactions,
    pagination,
    loading,
    error,
    refresh: loadTransactions,
    loadTransactions,
  };
}
