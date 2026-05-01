"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transactionsApi,
  type GetTransactionsParams,
  type CreateTransactionDto,
} from "@/lib/api/transactions";
import { checkOfflineStatus } from "@/lib/offline-detector";
import {
  getTransactionsFromDexie,
  saveTransactionsToDexie,
} from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import type { Transaction } from "@/types";
import type { PaginationMeta, PaginatedResponse } from "@/types/pagination";

interface UseTransactionsOptions extends GetTransactionsParams {
  autoLoad?: boolean;
  storeIdForOffline?: string | null;
}

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters?: GetTransactionsParams) =>
    [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

function normalizeTransactionResponse(
  response: Transaction[] | PaginatedResponse<Transaction>
): { data: Transaction[]; meta: PaginationMeta } {
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

  if ("data" in response && "meta" in response) {
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

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { autoLoad = true, storeIdForOffline, ...params } = options;
  const queryClient = useQueryClient();

  const queryKey = transactionKeys.list(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      return getTransactionsFromDexie(
        params.page ?? 1,
        params.limit ?? 10,
        storeIdForOffline ?? undefined
      );
    },
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTransactionDto) => {
      const tempId = `temp-${Date.now()}`;
      mutationQueue.add({
        mutationKey: ["transactions", "create"],
        variables: data,
        idempotencyKey: tempId,
      });
      return {
        data: {
          id: tempId,
          ...data,
          createdAt: new Date().toISOString(),
        } as Transaction,
      };
    },
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: transactionKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: Transaction[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticTransaction: Transaction = {
          id: `temp-${Date.now()}`,
          customerId: newTransaction.customerId || null,
          items: newTransaction.items,
          total: newTransaction.total,
          paymentMethod: newTransaction.paymentMethod,
          voucherCode: newTransaction.voucherCode || null,
          discountAmount: newTransaction.discountAmount || null,
          storeId: newTransaction.storeId,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: Transaction[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: [optimisticTransaction, ...previousData.data],
            meta: {
              ...previousData.meta,
              total: previousData.meta.total + 1,
            },
          }
        );
      }

      return { previousData };
    },
    onError: (err, newTransaction, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newTransaction = response.data;
      queryClient.setQueryData<{ data: Transaction[]; meta: PaginationMeta }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((t) =>
              t.id && String(t.id).startsWith("temp-") ? newTransaction : t
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
    },
  });

  return {
    transactions: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0,
    },
    loading: query.isLoading,
    error: query.error
      ? (query.error as any)?.response?.data?.message || query.error.message
      : null,
    createTransaction: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refresh: () => query.refetch(),
    loadTransactions: async (loadParams?: GetTransactionsParams) => {
      const newParams = { ...params, ...loadParams };
      const newQueryKey = transactionKeys.list(newParams);
      await queryClient.refetchQueries({ queryKey: newQueryKey });
      if (JSON.stringify(newParams) !== JSON.stringify(params)) {
        await queryClient.refetchQueries({ queryKey });
      }
    },
  };
}
