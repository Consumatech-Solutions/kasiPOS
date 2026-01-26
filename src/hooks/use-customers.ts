'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/customers';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseCustomersOptions {
  initialPage?: number;
  initialLimit?: number;
  searchQuery?: string;
}

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string }) => 
    [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

function normalizeCustomerResponse(response: Customer[] | PaginatedResponse<Customer>): { data: Customer[]; meta: PaginationMeta } {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: {
        total: response.length,
        page: 1,
        limit: response.length || 10,
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

export function useCustomers(options: UseCustomersOptions = {}) {
  const { initialPage = 1, initialLimit = 10, searchQuery = '' } = options;
  const queryClient = useQueryClient();
  
  const params: { page?: number; limit?: number; search?: string } = {};
  if (initialPage !== undefined) params.page = initialPage;
  if (initialLimit !== undefined) params.limit = initialLimit;
  if (searchQuery?.trim()) params.search = searchQuery.trim();
  
  const queryKey = customerKeys.list(Object.keys(params).length > 0 ? params : undefined);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const response = await customersApi.getAll(Object.keys(params).length > 0 ? params : undefined);
        return normalizeCustomerResponse(response.data);
      } catch (err: any) {
        // If 400 error, try without pagination parameters
        if (err?.response?.status === 400 && (params.page || params.limit)) {
          const fallbackParams = params.search ? { search: params.search } : undefined;
          const response = await customersApi.getAll(fallbackParams);
          return normalizeCustomerResponse(response.data);
        }
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCustomerDto) => customersApi.create(data),
    onMutate: async (newCustomer) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const optimisticCustomer: Customer = {
          id: `temp-${Date.now()}`,
          name: newCustomer.name,
          contact: newCustomer.contact,
          storeId: newCustomer.storeId || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: [...previousData.data, optimisticCustomer],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newCustomer, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newCustomer = response.data;
      queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(cust => cust.id?.startsWith('temp-') ? newCustomer : cust),
        };
      });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerDto }) =>
      customersApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(cust =>
            cust.id === id ? { ...cust, ...data, updatedAt: new Date().toISOString() } : cust
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
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(cust => cust.id !== id),
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
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });

  return {
    customers: query.data?.data || [],
    allCustomers: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: initialPage,
      limit: initialLimit,
      totalPages: 0,
    },
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createCustomer: createMutation.mutateAsync,
    updateCustomer: (id: string, data: UpdateCustomerDto) => updateMutation.mutateAsync({ id, data }),
    deleteCustomer: deleteMutation.mutateAsync,
    refresh: () => query.refetch(),
    loadPage: (page: number) => {
      queryClient.invalidateQueries({ 
        queryKey: customerKeys.list({ page, limit: initialLimit, search: searchQuery }) 
      });
    },
  };
}
