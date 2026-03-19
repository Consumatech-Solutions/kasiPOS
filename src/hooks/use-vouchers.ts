'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vouchersApi, type CreateVoucherDto, type UpdateVoucherDto, type GetVouchersParams, type ValidateVoucherDto } from '@/lib/api/vouchers';
import type { Voucher } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseVouchersOptions extends GetVouchersParams {
  autoLoad?: boolean;
}

export const voucherKeys = {
  all: ['vouchers'] as const,
  lists: () => [...voucherKeys.all, 'list'] as const,
  list: (filters?: GetVouchersParams) => [...voucherKeys.lists(), filters] as const,
  details: () => [...voucherKeys.all, 'detail'] as const,
  detail: (id: string) => [...voucherKeys.details(), id] as const,
};

function normalizeVoucherResponse(response: Voucher[] | PaginatedResponse<Voucher>): { data: Voucher[]; meta: PaginationMeta } {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: {
        total: response.length,
        page: 1,
        limit: response.length || 100,
        totalPages: 1,
      },
    };
  }
  
  if ('data' in response && 'meta' in response) {
    return response;
  }
  
  return {
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
  };
}

export function useVouchers(options: UseVouchersOptions = {}) {
  const { autoLoad = true, ...params } = options;
  const queryClient = useQueryClient();
  
  const queryKey = voucherKeys.list(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await vouchersApi.getAll(params);
      return normalizeVoucherResponse(response.data);
    },
    enabled: true, // Always enabled - we'll control loading via refetch
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateVoucherDto) => vouchersApi.create(data),
    onMutate: async (newVoucher) => {
      await queryClient.cancelQueries({ queryKey: voucherKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const optimisticVoucher: Voucher = {
          id: `temp-${Date.now()}`,
          code: newVoucher.code,
          discount: newVoucher.discount,
          discountType: newVoucher.discountType,
          isActive: newVoucher.isActive ?? true,
          storeId: newVoucher.storeId || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: [...previousData.data, optimisticVoucher],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newVoucher, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newVoucher = response.data;
      queryClient.setQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(v => v.id?.startsWith('temp-') ? newVoucher : v),
        };
      });
      queryClient.invalidateQueries({ queryKey: voucherKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVoucherDto }) =>
      vouchersApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: voucherKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(v =>
            v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v
          ),
        });
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voucherKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vouchersApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: voucherKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Voucher[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(v => v.id !== id),
          meta: {
            ...previousData.meta,
            total: Math.max(0, previousData.meta.total - 1),
          },
        });
      }

      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voucherKeys.lists() });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (data: ValidateVoucherDto) => vouchersApi.validate(data),
  });

  return {
    vouchers: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0,
    },
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createVoucher: createMutation.mutateAsync,
    updateVoucher: (id: string, data: UpdateVoucherDto) => updateMutation.mutateAsync({ id, data }),
    deleteVoucher: deleteMutation.mutateAsync,
    validateVoucher: validateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isValidating: validateMutation.isPending,
    refresh: () => query.refetch(),
    loadVouchers: () => query.refetch(),
  };
}
