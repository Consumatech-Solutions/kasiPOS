"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  stockAdjustmentsApi,
  type CreateStockAdjustmentDto,
  type GetStockAdjustmentsParams,
} from "@/lib/api/stock-adjustments";
import { getDb } from "@/lib/db";
import { getStockAdjustmentsFromDexie } from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import type { StockAdjustment } from "@/types";
import type { PaginationMeta, PaginatedResponse } from "@/types/pagination";

interface UseStockAdjustmentsOptions {
  productId?: string;
  initialPage?: number;
  initialLimit?: number;
  storeIdForOffline?: string | null;
}

export const stockAdjustmentKeys = {
  all: ["stockAdjustments"] as const,
  lists: () => [...stockAdjustmentKeys.all, "list"] as const,
  list: (filters?: GetStockAdjustmentsParams) =>
    [...stockAdjustmentKeys.lists(), filters] as const,
  byProduct: (productId: string) =>
    [...stockAdjustmentKeys.all, "product", productId] as const,
  details: () => [...stockAdjustmentKeys.all, "detail"] as const,
  detail: (id: string) => [...stockAdjustmentKeys.details(), id] as const,
};

function normalizeStockAdjustmentResponse(
  response: StockAdjustment[] | PaginatedResponse<StockAdjustment>
): { data: StockAdjustment[]; meta: PaginationMeta } {
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

export function useStockAdjustments(options: UseStockAdjustmentsOptions = {}) {
  const { productId, initialPage = 1, initialLimit = 10, storeIdForOffline } = options;
  const queryClient = useQueryClient();

  const queryKey = productId
    ? stockAdjustmentKeys.byProduct(productId)
    : stockAdjustmentKeys.list({
        page: initialPage,
        limit: initialLimit,
        productId,
      });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let resolvedProductId: string | null | undefined = productId;
      if (productId) {
        resolvedProductId = String(productId).startsWith("temp-")
          ? ((await getDb().syncIdMapping.get(String(productId)))?.serverId ?? null)
          : productId;
      }
      
      return getStockAdjustmentsFromDexie(
        initialPage,
        initialLimit,
        storeIdForOffline ?? undefined,
        resolvedProductId ?? undefined
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateStockAdjustmentDto) => {
      const tempId = `temp-${Date.now()}`;
      mutationQueue.add({
        mutationKey: ["stockAdjustments", "create"],
        variables: data,
        idempotencyKey: tempId,
      });
      return {
        data: {
          id: tempId,
          productId: data.productId,
          productName: "",
          oldStock: 0,
          newStock: data.newStock,
          reason: data.reason,
          note: data.note || null,
          storeId: storeIdForOffline ?? "",
          createdAt: new Date().toISOString(),
        } as StockAdjustment,
      };
    },
    onMutate: async (newAdjustment) => {
      await queryClient.cancelQueries({
        queryKey: stockAdjustmentKeys.lists(),
      });
      const previousData = queryClient.getQueryData<{
        data: StockAdjustment[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticAdjustment: StockAdjustment = {
          id: `temp-${Date.now()}`,
          productId: newAdjustment.productId,
          productName: "",
          oldStock: 0,
          newStock: newAdjustment.newStock,
          reason: newAdjustment.reason,
          note: newAdjustment.note || null,
          storeId: "",
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{
          data: StockAdjustment[];
          meta: PaginationMeta;
        }>(queryKey, {
          ...previousData,
          data: [optimisticAdjustment, ...previousData.data],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newAdjustment, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newAdjustment = response.data;
      queryClient.setQueryData<{
        data: StockAdjustment[];
        meta: PaginationMeta;
      }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((adj) =>
            adj.id && String(adj.id).startsWith("temp-") ? newAdjustment : adj
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: stockAdjustmentKeys.lists() });
      if (productId) {
        queryClient.invalidateQueries({
          queryKey: stockAdjustmentKeys.byProduct(productId),
        });
      }
    },
  });

  return {
    adjustments: query.data?.data || [],
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
    createAdjustment: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refresh: () => query.refetch(),
  };
}
