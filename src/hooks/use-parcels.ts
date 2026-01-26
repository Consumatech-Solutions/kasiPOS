'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parcelsApi, type GetParcelsParams, type Parcel, type CreateParcelDto, type ReceiveParcelDto, type CollectParcelDto } from '@/lib/api/parcels';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseParcelsOptions extends GetParcelsParams {
  autoLoad?: boolean;
}

export const parcelKeys = {
  all: ['parcels'] as const,
  lists: () => [...parcelKeys.all, 'list'] as const,
  list: (filters?: GetParcelsParams) => [...parcelKeys.lists(), filters] as const,
  details: () => [...parcelKeys.all, 'detail'] as const,
  detail: (id: string) => [...parcelKeys.details(), id] as const,
};

function normalizeParcelResponse(response: Parcel[] | PaginatedResponse<Parcel>): { data: Parcel[]; meta: PaginationMeta } {
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

export function useParcels(options: UseParcelsOptions = {}) {
  const { autoLoad = true, ...params } = options;
  const queryClient = useQueryClient();
  
  const queryKey = parcelKeys.list(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await parcelsApi.getAll(params);
      return normalizeParcelResponse(response.data);
    },
    enabled: true, // Always enabled - we'll control loading via refetch
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateParcelDto) => parcelsApi.create(data),
    onMutate: async (newParcel) => {
      await queryClient.cancelQueries({ queryKey: parcelKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const optimisticParcel: Parcel = {
          id: `temp-${Date.now()}`,
          deliveryNumber: newParcel.deliveryNumber,
          customerName: newParcel.customerName,
          status: 'Incoming',
          storeId: newParcel.storeId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: [...previousData.data, optimisticParcel],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newParcel, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (response) => {
      const newParcel = response.data;
      queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(p => (p.id && String(p.id).startsWith('temp-')) ? newParcel : p),
        };
      });
      queryClient.invalidateQueries({ queryKey: parcelKeys.lists() });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveParcelDto }) =>
      parcelsApi.receive(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: parcelKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(p =>
            p.id === id ? { ...p, status: 'Received' as const, receiptCode: data.receiptCode, dateReceived: new Date().toISOString(), updatedAt: new Date().toISOString() } : p
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
      queryClient.invalidateQueries({ queryKey: parcelKeys.lists() });
    },
  });

  const collectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CollectParcelDto }) =>
      parcelsApi.collect(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: parcelKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(p =>
            p.id === id ? { 
              ...p, 
              status: 'Collected' as const, 
              collectingPersonName: data.collectingPersonName,
              collectingPersonId: data.collectingPersonId,
              collectingPersonPhone: data.collectingPersonPhone,
              dateCollected: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } : p
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
      queryClient.invalidateQueries({ queryKey: parcelKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Parcel> }) =>
      parcelsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: parcelKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(p =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
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
      queryClient.invalidateQueries({ queryKey: parcelKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => parcelsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: parcelKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: Parcel[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(p => p.id !== id),
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
      queryClient.invalidateQueries({ queryKey: parcelKeys.lists() });
    },
  });

  return {
    parcels: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0,
    },
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createParcel: createMutation.mutateAsync,
    receiveParcel: (id: string, data: ReceiveParcelDto) => receiveMutation.mutateAsync({ id, data }),
    collectParcel: (id: string, data: CollectParcelDto) => collectMutation.mutateAsync({ id, data }),
    updateParcel: (id: string, data: Partial<Parcel>) => updateMutation.mutateAsync({ id, data }),
    deleteParcel: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isReceiving: receiveMutation.isPending,
    isCollecting: collectMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh: () => query.refetch(),
    loadParcels: (loadParams?: GetParcelsParams) => {
      queryClient.invalidateQueries({ queryKey: parcelKeys.list({ ...params, ...loadParams }) });
    },
  };
}
