import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogueApi } from '@/lib/api/catalogue';
import { checkOfflineStatus } from '@/lib/offline-detector';
import {
  pullAllProductsFromApi,
  pullAllCategoriesFromApi,
  parseProductsListResponse,
  parseCategoriesListResponse,
} from '@/lib/catalogue-network-hydrate';
import {
  getProductsFromDexie,
  saveProductsToDexie,
  getCategoriesFromDexie,
  saveCategoriesToDexie,
  deleteProductFromDexie,
} from '@/lib/entity-cache';
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

export interface UseCategoriesOptions {
  storeIdForOffline?: string | null;
}

export function useCategories(
  initialPage: number = 1,
  initialLimit: number = 10,
  options?: UseCategoriesOptions
) {
  const storeIdForOffline = options?.storeIdForOffline;
  const queryClient = useQueryClient();
  const queryKey = categoryKeys.list({
    page: initialPage,
    limit: initialLimit,
    storeIdForOffline: storeIdForOffline ?? undefined,
  });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const isOffline = await checkOfflineStatus();

      if (!isOffline) {
        try {
          const params: PaginationParams = {
            page: initialPage,
            limit: initialLimit,
            ...(storeIdForOffline ? { storeId: String(storeIdForOffline) } : {}),
          };
          let response = await catalogueApi.categories.getAll(params);
          let parsed = parseCategoriesListResponse(response, initialPage, initialLimit);
          if (parsed.data.length === 0 && storeIdForOffline) {
            const retry = await catalogueApi.categories.getAll({
              page: initialPage,
              limit: initialLimit,
            });
            parsed = parseCategoriesListResponse(retry, initialPage, initialLimit);
          }
          if (parsed.data.length > 0) {
            await saveCategoriesToDexie(parsed.data, storeIdForOffline ?? undefined);
          }
          if (parsed.data.length === 0) {
            const dexieFallback = await getCategoriesFromDexie(initialPage, initialLimit, storeIdForOffline);
            if (dexieFallback.meta.total > 0) return dexieFallback;
          }
          return parsed;
        } catch (e) {
          console.warn('[useCategories] API failed, using Dexie', e);
        }
      }

      let result = await getCategoriesFromDexie(initialPage, initialLimit, storeIdForOffline);
      if (!isOffline && storeIdForOffline && result.meta.total === 0) {
        try {
          let n = await pullAllCategoriesFromApi(storeIdForOffline, { storeIdQueryParam: true });
          if (n === 0) await pullAllCategoriesFromApi(storeIdForOffline, { storeIdQueryParam: false });
          result = await getCategoriesFromDexie(initialPage, initialLimit, storeIdForOffline);
        } catch (e) {
          console.warn('[useCategories] Bulk hydrate failed', e);
        }
      }
      return result;
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: 'online',
    placeholderData: (previousData) => previousData,
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
    onSuccess: async (newCategory) => {
      // Replace optimistic update with real data
      queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(cat => (String(cat?.id ?? '').startsWith('temp-') ? newCategory : cat)),
        };
      });
      await saveCategoriesToDexie([newCategory], storeIdForOffline ?? undefined);
      // Defer invalidation to avoid unmount race (dialog/row closing)
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      });
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
            String(cat.id) === String(id) ? { ...cat, ...data, updatedAt: new Date().toISOString() } : cat
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
    onSuccess: async (updatedCategory) => {
      await saveCategoriesToDexie([updatedCategory], storeIdForOffline ?? undefined);
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogueApi.categories.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const idStr = String(id);
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(cat => String(cat.id) !== idStr),
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
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      });
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
      queryClient.invalidateQueries({
        queryKey: categoryKeys.list({
          page,
          limit: initialLimit,
          storeIdForOffline: storeIdForOffline ?? undefined,
        }),
      });
    },
  };
}

export interface UseProductsOptions {
  storeIdForOffline?: string | null;
}

export function useProducts(
  initialPage: number = 1,
  initialLimit: number = 10,
  options?: UseProductsOptions
) {
  const storeIdForOffline = options?.storeIdForOffline;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Omit<PaginationParams, 'page' | 'limit'>>({});
  const [currentPage, setCurrentPage] = useState(initialPage);

  const queryKey = productKeys.list({
    page: currentPage,
    limit: initialLimit,
    ...filters,
    storeIdForOffline: storeIdForOffline ?? undefined,
  });

  const dexieListFilters = {
    search: filters.search,
    categoryId: filters.categoryId,
  };

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const isOffline = await checkOfflineStatus();

      if (!isOffline) {
        try {
          const params: PaginationParams = {
            page: currentPage,
            limit: initialLimit,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            ...(storeIdForOffline ? { storeId: String(storeIdForOffline) } : {}),
          };
          let response = await catalogueApi.products.getAll(params);
          let parsed = parseProductsListResponse(response, currentPage, initialLimit);
          if (parsed.data.length === 0 && storeIdForOffline) {
            const retry = await catalogueApi.products.getAll({
              page: currentPage,
              limit: initialLimit,
              ...(filters.search ? { search: filters.search } : {}),
              ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            });
            parsed = parseProductsListResponse(retry, currentPage, initialLimit);
          }
          if (parsed.data.length > 0) {
            await saveProductsToDexie(parsed.data, storeIdForOffline ?? undefined);
          }
          if (parsed.data.length === 0) {
            const dexieFallback = await getProductsFromDexie(
              currentPage,
              initialLimit,
              storeIdForOffline,
              dexieListFilters
            );
            if (dexieFallback.meta.total > 0) return dexieFallback;
          }
          return parsed;
        } catch (e) {
          console.warn('[useProducts] API failed, using Dexie', e);
        }
      }

      let result = await getProductsFromDexie(currentPage, initialLimit, storeIdForOffline, dexieListFilters);
      if (!isOffline && storeIdForOffline && result.meta.total === 0) {
        try {
          let n = await pullAllProductsFromApi(storeIdForOffline, { storeIdQueryParam: true });
          if (n === 0) await pullAllProductsFromApi(storeIdForOffline, { storeIdQueryParam: false });
          result = await getProductsFromDexie(currentPage, initialLimit, storeIdForOffline, dexieListFilters);
        } catch (e) {
          console.warn('[useProducts] Bulk hydrate failed', e);
        }
      }
      return result;
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: 'online',
    placeholderData: (previousData) => previousData,
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
    onSuccess: async (newProduct) => {
      queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(prod => (String(prod?.id ?? '').startsWith('temp-') ? newProduct : prod)),
        };
      });
      await saveProductsToDexie([newProduct], storeIdForOffline ?? undefined);
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      });
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
            String(prod.id) === String(id) ? { ...prod, ...data, updatedAt: new Date().toISOString() } : prod
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
    onSuccess: async (updatedProduct) => {
      await saveProductsToDexie([updatedProduct], storeIdForOffline ?? undefined);
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogueApi.products.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey);

      if (previousData) {
        const idStr = String(id);
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(queryKey, {
          ...previousData,
          data: previousData.data.filter(prod => String(prod.id) !== idStr),
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
    onSuccess: async (_data, productId) => {
      await deleteProductFromDexie(String(productId));
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      });
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
