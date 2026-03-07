import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogueApi } from '@/lib/api/catalogue';
import { checkOfflineStatus } from '@/lib/offline-detector';
import { getProductsFromDexie, saveProductsToDexie, getCategoriesFromDexie, saveCategoriesToDexie } from '@/lib/entity-cache';
import type { ApiCategory, ApiProduct, CreateCategoryDto, UpdateCategoryDto, CreateProductDto, UpdateProductDto } from '@/types/catalogue';
import type { PaginationMeta, PaginationParams } from '@/types/pagination';

// Query keys
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters: PaginationParams) => [...categoryKeys.lists(), filters] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: PaginationParams) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

// Helper to normalize API response
function normalizeResponse<T>(response: T[] | { data: T[]; meta: PaginationMeta }): { data: T[]; meta: PaginationMeta } {
  if ('data' in response && 'meta' in response) {
    return response;
  }
  const data = response as T[];
  return {
    data,
    meta: {
      total: data.length,
      page: 1,
      limit: data.length || 10,
      totalPages: 1,
    },
  };
}

export function useCategories(initialPage: number = 1, initialLimit: number = 10) {
  const queryClient = useQueryClient();
  const queryKey = categoryKeys.list({ page: initialPage, limit: initialLimit });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const isOffline = await checkOfflineStatus();
      if (isOffline) {
        return getCategoriesFromDexie(initialPage, initialLimit);
      }
      const response = await catalogueApi.categories.getAll({ page: initialPage, limit: initialLimit });
      const normalized = normalizeResponse(response);
      if (normalized.data?.length) {
        await saveCategoriesToDexie(normalized.data);
      }
      return normalized;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryDto) => catalogueApi.categories.create(data),
    onMutate: async (newCategory) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey);

      // Optimistically update
      if (previousData) {
        const optimisticCategory: ApiCategory = {
          id: `temp-${Date.now()}`,
          name: newCategory.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: [...previousData.data, optimisticCategory],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newCategory, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (newCategory) => {
      // Replace optimistic update with real data
      queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(cat => cat.id?.startsWith('temp-') ? newCategory : cat),
        };
      });
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDto }) =>
      catalogueApi.categories.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(cat =>
            cat.id === id ? { ...cat, ...data, updatedAt: new Date().toISOString() } : cat
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
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogueApi.categories.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(cat => cat.id !== id),
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
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });

  return {
    categories: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: initialPage,
      limit: initialLimit,
      totalPages: 1,
    },
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createCategory: createMutation.mutateAsync,
    updateCategory: (id: string, data: UpdateCategoryDto) => updateMutation.mutateAsync({ id, data }),
    deleteCategory: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh: () => query.refetch(),
    loadPage: (page: number) => {
      // This would need to be handled by changing the query key, but for backward compatibility
      // we'll just refetch with the new page
      queryClient.invalidateQueries({ queryKey: categoryKeys.list({ page, limit: initialLimit }) });
    },
  };
}

export function useProducts(initialPage: number = 1, initialLimit: number = 10) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Omit<PaginationParams, 'page' | 'limit'>>({});
  const [currentPage, setCurrentPage] = useState(initialPage);
  
  const queryKey = productKeys.list({ page: currentPage, limit: initialLimit, ...filters });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const isOffline = await checkOfflineStatus();
      if (isOffline) {
        return getProductsFromDexie(currentPage, initialLimit);
      }
      const response = await catalogueApi.products.getAll({ page: currentPage, limit: initialLimit, ...filters });
      const normalized = normalizeResponse(response);
      if (normalized.data?.length) {
        await saveProductsToDexie(normalized.data);
      }
      return normalized;
    },
    staleTime: 0, // Always consider data stale to refetch on navigation
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductDto | { name: string; price: number; costPrice: number; stock?: number; barCode?: string; productImage?: string; category: string }) => {
      let createDto: CreateProductDto;

      if ('categoryId' in data) {
        createDto = data;
      } else {
        // Resolve category name to ID
        const categoriesResp = await catalogueApi.categories.getAll();
        const categories = 'data' in categoriesResp ? categoriesResp.data : (categoriesResp as ApiCategory[]);
        const category = categories.find(c => c.name === data.category);

        if (!category) {
          throw new Error(`Category "${data.category}" not found`);
        }

        createDto = {
          name: data.name,
          price: data.price,
          costPrice: data.costPrice,
          stock: data.stock,
          barCode: data.barCode || (data as any).barcode,
          productImage: data.productImage || (data as any).imageUrl,
          categoryId: category.id,
        };
      }

      return catalogueApi.products.create(createDto);
    },
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const optimisticProduct: ApiProduct = {
          id: `temp-${Date.now()}`,
          name: 'name' in newProduct ? newProduct.name : '',
          price: 'price' in newProduct ? newProduct.price : 0,
          costPrice: 'costPrice' in newProduct ? newProduct.costPrice : 0,
          stock: ('stock' in newProduct ? newProduct.stock : undefined) ?? null,
          barCode: ('barCode' in newProduct ? newProduct.barCode : undefined) ?? null,
          productImage: ('productImage' in newProduct ? newProduct.productImage : undefined) ?? null,
          categoryId: 'categoryId' in newProduct ? newProduct.categoryId : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: [...previousData.data, optimisticProduct],
          meta: {
            ...previousData.meta,
            total: previousData.meta.total + 1,
          },
        });
      }

      return { previousData };
    },
    onError: (err, newProduct, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: (newProduct) => {
      queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(prod => prod.id?.startsWith('temp-') ? newProduct : prod),
        };
      });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProductDto | any }) => {
      let updateDto: UpdateProductDto = { ...data };

      // If category is provided as a string name, resolve it to categoryId
      if ('category' in data && typeof data.category === 'string' && !data.categoryId) {
        const categoriesResp = await catalogueApi.categories.getAll();
        const categories = 'data' in categoriesResp ? categoriesResp.data : (categoriesResp as ApiCategory[]);
        const category = categories.find(c => c.name === data.category);

        if (!category) {
          throw new Error(`Category "${data.category}" not found`);
        }

        updateDto.categoryId = category.id;
        delete (updateDto as any).category;
      }

      // Normalize field names
      if (data.barcode && !data.barCode) {
        updateDto.barCode = data.barcode;
        delete (updateDto as any).barcode;
      }
      if (data.imageUrl && !data.productImage) {
        updateDto.productImage = data.imageUrl;
        delete (updateDto as any).imageUrl;
      }

      return catalogueApi.products.update(id, updateDto);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.map(prod =>
            prod.id === id ? { ...prod, ...data, updatedAt: new Date().toISOString() } : prod
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
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogueApi.products.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(prod => prod.id !== id),
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
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });

  return {
    products: query.data?.data || [],
    pagination: query.data?.meta || {
      total: 0,
      page: currentPage,
      limit: initialLimit,
      totalPages: 1,
    },
    loading: query.isLoading,
    error: query.error ? (query.error as any)?.response?.data?.message || query.error.message : null,
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, data: UpdateProductDto | any) => updateMutation.mutateAsync({ id, data }),
    deleteProduct: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    setFilters,
    refresh: () => query.refetch(),
    loadPage: setCurrentPage,
  };
}
