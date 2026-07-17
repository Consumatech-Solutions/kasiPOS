"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { checkOfflineStatus } from "@/lib/offline-detector";
import {
  getCustomersFromDexie,
  saveCustomersToDexie,
  updateCustomerInDexie,
  deleteCustomerFromDexie,
} from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import { dashboardStatsKeys } from "@/hooks/use-dashboard-stats";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "@/types";
import type {
  PaginationMeta,
  PaginationParams,
  PaginatedResponse,
} from "@/types/pagination";

interface UseCustomersOptions {
  initialPage?: number;
  initialLimit?: number;
  searchQuery?: string;
  storeId?: string | null;
  storeIdForOffline?: string | null;
}

export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (filters?: {
    page?: number;
    limit?: number;
    search?: string;
    storeId?: string | null;
  }) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomers(options: UseCustomersOptions = {}) {
  const {
    initialPage = 1,
    initialLimit = 10,
    searchQuery = "",
    storeId,
    storeIdForOffline,
  } = options;
  const queryClient = useQueryClient();

  const params: {
    page?: number;
    limit?: number;
    search?: string;
    storeId?: string | null;
  } = {};
  if (initialPage !== undefined) params.page = initialPage;
  if (initialLimit !== undefined) params.limit = initialLimit;
  if (searchQuery?.trim()) params.search = searchQuery.trim();
  if (storeId != null && storeId !== "") params.storeId = storeId;

  const queryKey = customerKeys.list(
    Object.keys(params).length > 0 ? params : undefined
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      return getCustomersFromDexie(
        initialPage,
        initialLimit,
        searchQuery?.trim() || undefined
        //storeIdForOffline ?? undefined
      );
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCustomerDto) => {
      const tempId = `temp-${Date.now()}`;
      mutationQueue.add({
        mutationKey: ["customers", "create"],
        variables: data,
        idempotencyKey: tempId,
      });

      return {
        id: tempId,
        ...data,
        loyaltyPoints: data.loyaltyPoints ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Customer;
    },
    onMutate: async (newCustomer) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: Customer[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticCustomer: Customer = {
          id: `temp-${Date.now()}`,
          name: newCustomer.name,
          contact: newCustomer.contact,
          loyaltyPoints: newCustomer.loyaltyPoints || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storeId: newCustomer.storeId ?? storeId ?? undefined,
        };
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: [...previousData.data, optimisticCustomer],
            meta: {
              ...previousData.meta,
              total: previousData.meta.total + 1,
            },
          }
        );
      }

      return { previousData };
    },
    onError: (err, newCustomer, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: async (response) => {
      const newCustomer = response;
      queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((cust) =>
              cust.id?.startsWith("temp-") ? newCustomer : cust
            ),
          };
        }
      );
      await saveCustomersToDexie([newCustomer]);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCustomerDto;
    }) => {
      mutationQueue.add({
        mutationKey: ["customers", "update", id],
        variables: { id, ...data },
      });
      return {
        id,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Customer;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: Customer[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.map((cust) =>
              cust.id === id
                ? { ...cust, ...data, updatedAt: new Date().toISOString() }
                : cust
            ),
          }
        );
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: async (updated) => {
      await updateCustomerInDexie(String(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      mutationQueue.add({
        mutationKey: ["customers", "delete", id],
        variables: { id },
      });
      return { id };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: Customer[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Customer[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.filter((cust) => cust.id !== id),
            meta: {
              ...previousData.meta,
              total: Math.max(0, previousData.meta.total - 1),
            },
          }
        );
      }

      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: async (_data, id) => {
      await deleteCustomerFromDexie(String(id));
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
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
    error: query.error
      ? (query.error as any)?.response?.data?.message || query.error.message
      : null,
    createCustomer: createMutation.mutateAsync,
    updateCustomer: (id: string, data: UpdateCustomerDto) =>
      updateMutation.mutateAsync({ id, data }),
    deleteCustomer: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh: () => query.refetch(),
    loadPage: (page: number) => {
      queryClient.invalidateQueries({
        queryKey: customerKeys.list({
          page,
          limit: initialLimit,
          search: searchQuery,
          storeId: storeId ?? undefined,
        }),
      });
    },
  };
}
