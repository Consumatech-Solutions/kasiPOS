import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogueApi } from "@/lib/api/catalogue";
import { checkOfflineStatus } from "@/lib/offline-detector";
import {
  pullAllProductsFromApi,
  pullAllCategoriesFromApi,
  parseProductsListResponse,
  parseCategoriesListResponse,
} from "@/lib/catalogue-network-hydrate";
import {
  getProductsFromDexie,
  saveProductsToDexie,
  getCategoriesFromDexie,
  saveCategoriesToDexie,
  deleteProductFromDexie,
} from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import type {
  ApiCategory,
  ApiProduct,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
} from "@/types/catalogue";
import type { PaginationMeta, PaginationParams } from "@/types/pagination";

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (filters: PaginationParams) =>
    [...categoryKeys.lists(), filters] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: PaginationParams) =>
    [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, "detail"] as const,
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
      return getCategoriesFromDexie(
        initialPage,
        initialLimit,
        storeIdForOffline
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: "online",
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCategoryDto) => {
      const tempId = `temp-${Date.now()}`;
      
      mutationQueue.add({
        mutationKey: ["categories", "create"],
        variables: data,
        idempotencyKey: tempId,
      });

      return {
        id: tempId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    },
    onMutate: async (newCategory) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });

      const previousData = queryClient.getQueryData<{
        data: ApiCategory[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticCategory: ApiCategory = {
          id: `temp-${Date.now()}`,
          name: newCategory.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: [...previousData.data, optimisticCategory],
            meta: {
              ...previousData.meta,
              total: previousData.meta.total + 1,
            },
          }
        );
      }

      return { previousData };
    },
    onError: (err, newCategory, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: async (newCategory) => {
      queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((cat) =>
              String(cat?.id ?? "").startsWith("temp-") ? newCategory : cat
            ),
          };
        }
      );
      await saveCategoriesToDexie(
        [newCategory],
        storeIdForOffline ?? undefined
      );
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCategoryDto }) => {
      mutationQueue.add({
        mutationKey: ["categories", "update", id],
        variables: { id, ...data },
      });
      return { id, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ApiCategory;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: ApiCategory[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.map((cat) =>
              String(cat.id) === String(id)
                ? { ...cat, ...data, updatedAt: new Date().toISOString() }
                : cat
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
    onSuccess: async (updatedCategory) => {
      await saveCategoriesToDexie(
        [updatedCategory],
        storeIdForOffline ?? undefined
      );
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      mutationQueue.add({
        mutationKey: ["categories", "delete", id],
        variables: { id },
      });
      return { id };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: ApiCategory[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const idStr = String(id);
        queryClient.setQueryData<{ data: ApiCategory[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.filter((cat) => String(cat.id) !== idStr),
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
    error: query.error
      ? (query.error as any)?.response?.data?.message || query.error.message
      : null,
    createCategory: createMutation.mutateAsync,
    updateCategory: (id: string, data: UpdateCategoryDto) =>
      updateMutation.mutateAsync({ id, data }),
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
  const [filters, setFilters] = useState<
    Omit<PaginationParams, "page" | "limit">
  >({});
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
      return getProductsFromDexie(
        currentPage,
        initialLimit,
        storeIdForOffline,
        dexieListFilters
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: "online",
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: async (
      data:
        | CreateProductDto
        | {
            name: string;
            price: number;
            costPrice: number;
            stock?: number;
            lowStockThreshold?: number;
            barCode?: string;
            productImage?: string;
            category: string;
          }
    ) => {
      let createDto: CreateProductDto;

      if ("categoryId" in data) {
        createDto = data as CreateProductDto;
      } else {
        const categoriesResp = await getCategoriesFromDexie(1, 10000, storeIdForOffline);
        const categories = categoriesResp.data;
        const category = categories.find((c) => c.name === data.category);

        if (!category) {
          throw new Error(`Category "${data.category}" not found`);
        }

        createDto = {
          name: data.name,
          price: data.price,
          costPrice: data.costPrice,
          stock: data.stock,
          lowStockThreshold: data.lowStockThreshold,
          barCode: data.barCode || (data as any).barcode,
          productImage: data.productImage || (data as any).imageUrl,
          categoryId: category.id,
        };
      }
      
      const tempId = `temp-${Date.now()}`;
      
      mutationQueue.add({
        mutationKey: ["products", "create"],
        variables: createDto,
        idempotencyKey: tempId,
      });

      return {
        id: tempId,
        ...createDto,
        stock: createDto.stock ?? null,
        barCode: createDto.barCode ?? null,
        productImage: createDto.productImage ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as ApiProduct;
    },
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: ApiProduct[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const optimisticProduct: ApiProduct = {
          id: `temp-${Date.now()}`,
          name: "name" in newProduct ? newProduct.name : "",
          price: "price" in newProduct ? newProduct.price : 0,
          costPrice: "costPrice" in newProduct ? newProduct.costPrice : 0,
          stock: ("stock" in newProduct ? newProduct.stock : undefined) ?? null,
          barCode:
            ("barCode" in newProduct ? newProduct.barCode : undefined) ?? null,
          productImage:
            ("productImage" in newProduct
              ? newProduct.productImage
              : undefined) ?? null,
          categoryId: "categoryId" in newProduct ? newProduct.categoryId : "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: [...previousData.data, optimisticProduct],
            meta: {
              ...previousData.meta,
              total: previousData.meta.total + 1,
            },
          }
        );
      }

      return { previousData };
    },
    onError: (err, newProduct, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSuccess: async (newProduct) => {
      queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((prod) =>
              String(prod?.id ?? "").startsWith("temp-") ? newProduct : prod
            ),
          };
        }
      );
      await saveProductsToDexie([newProduct], storeIdForOffline ?? undefined);
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProductDto | any;
    }) => {
      const updateDto: UpdateProductDto = { ...data };

      if (
        "category" in data &&
        typeof data.category === "string" &&
        !data.categoryId
      ) {
        const categoriesResp = await getCategoriesFromDexie(1, 10000, storeIdForOffline);
        const categories = categoriesResp.data;
        const category = categories.find((c) => c.name === data.category);

        if (!category) {
          throw new Error(`Category "${data.category}" not found`);
        }

        updateDto.categoryId = category.id;
        delete (updateDto as any).category;
      }

      if (data.barcode && !data.barCode) {
        updateDto.barCode = data.barcode;
        delete (updateDto as any).barcode;
      }
      if (data.imageUrl && !data.productImage) {
        updateDto.productImage = data.imageUrl;
        delete (updateDto as any).imageUrl;
      }

      mutationQueue.add({
        mutationKey: ["products", "update", id],
        variables: { id, ...updateDto },
      });
      
      return { id, ...updateDto, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ApiProduct;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: ApiProduct[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.map((prod) =>
              String(prod.id) === String(id)
                ? { ...prod, ...data, updatedAt: new Date().toISOString() }
                : prod
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
    onSuccess: async (updatedProduct) => {
      await saveProductsToDexie(
        [updatedProduct],
        storeIdForOffline ?? undefined
      );
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      mutationQueue.add({
        mutationKey: ["products", "delete", id],
        variables: { id },
      });
      return { id };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const previousData = queryClient.getQueryData<{
        data: ApiProduct[];
        meta: PaginationMeta;
      }>(queryKey);

      if (previousData) {
        const idStr = String(id);
        queryClient.setQueryData<{ data: ApiProduct[]; meta: PaginationMeta }>(
          queryKey,
          {
            ...previousData,
            data: previousData.data.filter((prod) => String(prod.id) !== idStr),
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
    error: query.error
      ? (query.error as any)?.response?.data?.message || query.error.message
      : null,
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, data: UpdateProductDto | any) =>
      updateMutation.mutateAsync({ id, data }),
    deleteProduct: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    setFilters,
    refresh: () => query.refetch(),
    loadPage: setCurrentPage,
  };
}
