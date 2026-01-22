'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { vouchersApi, type CreateVoucherDto, type UpdateVoucherDto, type GetVouchersParams, type ValidateVoucherDto } from '@/lib/api/vouchers';
import type { Voucher } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseVouchersOptions extends GetVouchersParams {
  autoLoad?: boolean;
}

export function useVouchers(options: UseVouchersOptions = {}) {
  const { autoLoad = true, ...params } = options;

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
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

  const loadVouchers = useCallback(async (loadParams?: GetVouchersParams) => {
    try {
      setLoading(true);
      setError(null);

      // Use ref to get latest params
      const requestParams = { ...paramsRef.current, ...loadParams };
      const response = await vouchersApi.getAll(requestParams);

      const responseData = response.data;
      if (Array.isArray(responseData)) {
        setVouchers(responseData);
        setPagination({
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        });
      } else {
        setVouchers(responseData.data);
        setPagination(responseData.meta);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load vouchers';
      setError(errorMessage);
      console.error('Error loading vouchers:', err);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - use ref for params

  useEffect(() => {
    if (autoLoad) {
      loadVouchers();
    }
  }, [autoLoad, loadVouchers]);

  const createVoucher = useCallback(async (data: CreateVoucherDto): Promise<Voucher> => {
    try {
      setError(null);
      const response = await vouchersApi.create(data);
      const created = response.data;
      await loadVouchers();
      return created;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to create voucher';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadVouchers]);

  const updateVoucher = useCallback(async (id: string, data: UpdateVoucherDto): Promise<Voucher> => {
    try {
      setError(null);
      const response = await vouchersApi.update(id, data);
      const updated = response.data;
      await loadVouchers();
      return updated;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to update voucher';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadVouchers]);

  const deleteVoucher = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await vouchersApi.delete(id);
      await loadVouchers();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to delete voucher';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadVouchers]);

  const validateVoucher = useCallback(async (data: ValidateVoucherDto) => {
    try {
      setError(null);
      const response = await vouchersApi.validate(data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to validate voucher';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  return {
    vouchers,
    pagination,
    loading,
    error,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    validateVoucher,
    refresh: loadVouchers,
    loadVouchers,
  };
}
