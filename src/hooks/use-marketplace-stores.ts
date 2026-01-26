'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceStoresApi, type MarketplaceStore, type CreateMarketplaceStoreDto, type UpdateMarketplaceStoreDto } from '@/lib/api/marketplace-stores';

interface UseMarketplaceStoresOptions {
  activeOnly?: boolean;
  autoLoad?: boolean;
}

export const marketplaceStoreKeys = {
  all: ['marketplaceStores'] as const,
  lists: () => [...marketplaceStoreKeys.all, 'list'] as const,
  list: (activeOnly?: boolean) => [...marketplaceStoreKeys.lists(), { activeOnly }] as const,
  details: () => [...marketplaceStoreKeys.all, 'detail'] as const,
  detail: (id: string) => [...marketplaceStoreKeys.details(), id] as const,
  byCode: (code: string) => [...marketplaceStoreKeys.all, 'code', code] as const,
};

export function useMarketplaceStores(options: UseMarketplaceStoresOptions = {}) {
  const { activeOnly = true, autoLoad = true } = options;
  const queryClient = useQueryClient();
  
  const queryKey = marketplaceStoreKeys.list(activeOnly);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await marketplaceStoresApi.getAll(activeOnly);
      return response.data;
    },
    enabled: true, // Always enabled - we'll control loading via refetch
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMarketplaceStoreDto) => marketplaceStoresApi.create(data),
    onMutate: async (newStore) => {
      await queryClient.cancelQueries({ queryKey: marketplaceStoreKeys.lists() });
      const previousData = queryClient.getQueryData<MarketplaceStore[]>(queryKey);

      if (previousData) {
        const optimisticStore: MarketplaceStore = {
          id: `temp-${Date.now()}`,
          code: newStore.code,
          name: newStore.name,
          logoUrl: newStore.logoUrl || null,
          description: newStore.description || null,
          isActive: newStore.isActive ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<MarketplaceStore[]>(queryKey, [...previousData, optimisticStore]);
      }

      return { previousData };
    },
    onError: (err, newStore, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newStore = response.data;
      queryClient.setQueryData<MarketplaceStore[]>(queryKey, (old) => {
        if (!old) return [newStore];
        return old.map(s => (s.id && String(s.id).startsWith('temp-')) ? newStore : s);
      });
      queryClient.invalidateQueries({ queryKey: marketplaceStoreKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMarketplaceStoreDto }) =>
      marketplaceStoresApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: marketplaceStoreKeys.lists() });
      const previousData = queryClient.getQueryData<MarketplaceStore[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<MarketplaceStore[]>(queryKey, previousData.map(s =>
          s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
        ));
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceStoreKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketplaceStoresApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: marketplaceStoreKeys.lists() });
      const previousData = queryClient.getQueryData<MarketplaceStore[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<MarketplaceStore[]>(queryKey, previousData.filter(s => s.id !== id));
      }

      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceStoreKeys.lists() });
    },
  });

  return {
    stores: query.data || [],
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createStore: createMutation.mutateAsync,
    updateStore: (id: string, data: UpdateMarketplaceStoreDto) => updateMutation.mutateAsync({ id, data }),
    deleteStore: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh: () => query.refetch(),
    loadStores: () => query.refetch(),
  };
}
