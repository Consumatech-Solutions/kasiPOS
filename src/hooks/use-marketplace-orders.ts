"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  marketplaceOrdersApi,
  type GetMarketplaceOrdersParams,
  type MarketplaceOrder,
  type CreateMarketplaceOrderDto,
} from "@/lib/api/marketplace-orders";
import type { PaginationMeta, PaginatedResponse } from "@/types/pagination";

interface UseMarketplaceOrdersOptions extends GetMarketplaceOrdersParams {
  autoLoad?: boolean;
}

export const marketplaceOrderKeys = {
  all: ["marketplaceOrders"] as const,
  lists: () => [...marketplaceOrderKeys.all, "list"] as const,
  list: (filters?: GetMarketplaceOrdersParams) =>
    [...marketplaceOrderKeys.lists(), filters] as const,
  details: () => [...marketplaceOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...marketplaceOrderKeys.details(), id] as const,
  search: (code: string) =>
    [...marketplaceOrderKeys.all, "search", code] as const,
};

function normalizeMarketplaceOrderResponse(
  response: MarketplaceOrder[] | PaginatedResponse<MarketplaceOrder>,
): { data: MarketplaceOrder[]; meta: PaginationMeta } {
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

export function useMarketplaceOrders(
  options: UseMarketplaceOrdersOptions = {},
) {
  const { autoLoad = true, ...params } = options;
  const queryClient = useQueryClient();

  const queryKey = marketplaceOrderKeys.list(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await marketplaceOrdersApi.getAll(params);
      return normalizeMarketplaceOrderResponse(response.data);
    },
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMarketplaceOrderDto) =>
      marketplaceOrdersApi.create(data),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({
        queryKey: marketplaceOrderKeys.lists(),
      });
      const previousData = queryClient.getQueryData<{
        data: MarketplaceOrder[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticOrder: MarketplaceOrder = {
          id: `temp-${Date.now()}`,
          orderCode: `TEMP-${Date.now()}`,
          marketplaceStoreId: newOrder.marketplaceStoreId,
          storeId: newOrder.storeId,
          customerId: newOrder.customerId || null,
          items: newOrder.items,
          subtotal: newOrder.subtotal,
          vatAmount: newOrder.vatAmount || 0,
          serviceFee: newOrder.serviceFee || 0,
          total: newOrder.total,
          paymentMethod: newOrder.paymentMethod,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{
          data: MarketplaceOrder[];
          meta: PaginationMeta;
        }>(queryKey, {
          ...previousData,
          data: [optimisticOrder, ...previousData.data],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newOrder, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newOrder = response.data;
      queryClient.setQueryData<{
        data: MarketplaceOrder[];
        meta: PaginationMeta;
      }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((o) =>
            o.id && String(o.id).startsWith("temp-") ? newOrder : o,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: marketplaceOrderKeys.lists() });
    },
  });

  const findByOrderCodeMutation = useMutation({
    mutationFn: (code: string) => marketplaceOrdersApi.findByOrderCode(code),
    onSuccess: (response, code) => {
      queryClient.setQueryData(
        marketplaceOrderKeys.search(code),
        response.data,
      );
    },
  });

  const findByOrderCode = async (code: string) => {
    return await findByOrderCodeMutation.mutateAsync(code);
  };

  return {
    orders: query.data?.data || [],
    foundOrder: findByOrderCodeMutation.data?.data || null,
    pagination: query.data?.meta || {
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0,
    },
    loading: query.isLoading,
    searchLoading: findByOrderCodeMutation.isPending,
    error: query.error
      ? (query.error as any)?.response?.data?.message || query.error.message
      : null,
    createOrder: createMutation.mutateAsync,
    findByOrderCode,
    isCreating: createMutation.isPending,
    refresh: () => query.refetch(),
    loadOrders: (loadParams?: GetMarketplaceOrdersParams) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceOrderKeys.list({ ...params, ...loadParams }),
      });
    },
  };
}
