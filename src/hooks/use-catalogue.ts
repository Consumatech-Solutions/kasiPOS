import { useState, useEffect, useCallback } from 'react';
import { catalogueApi } from '@/lib/api/catalogue';
import type { ApiCategory, ApiProduct, CreateCategoryDto, UpdateCategoryDto, CreateProductDto, UpdateProductDto } from '@/types/catalogue';
import type { PaginationMeta, PaginationParams } from '@/types/pagination';

export function useCategories(initialPage: number = 1, initialLimit: number = 10) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: initialPage,
    limit: initialLimit,
    totalPages: 1,
  });

  const loadData = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await catalogueApi.categories.getAll({ page, limit: initialLimit });

      if ('data' in response && 'meta' in response) {
        setCategories(response.data);
        setPagination(response.meta);
      } else {
        const data = response as ApiCategory[];
        setCategories(data);
        setPagination({
          total: data.length,
          page,
          limit: initialLimit,
          totalPages: Math.ceil(data.length / initialLimit) || 1,
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Error loading categories');
    } finally {
      setLoading(false);
    }
  }, [initialLimit]);

  useEffect(() => {
    loadData(currentPage);
  }, [loadData, currentPage]);

  const createCategory = useCallback(async (data: CreateCategoryDto): Promise<ApiCategory> => {
    try {
      setError(null);
      const newCategory = await catalogueApi.categories.create(data);
      await loadData(currentPage);
      return newCategory;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error creating category');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage]);

  const updateCategory = useCallback(async (id: string, data: UpdateCategoryDto): Promise<ApiCategory> => {
    try {
      setError(null);
      const updated = await catalogueApi.categories.update(id, data);
      await loadData(currentPage);
      return updated;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error updating category');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage]);

  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await catalogueApi.categories.delete(id);
      await loadData(currentPage);
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error deleting category');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage]);

  const loadPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return {
    categories,
    pagination,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: () => loadData(currentPage),
    loadPage,
  };
}


export function useProducts(initialPage: number = 1, initialLimit: number = 10) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filters, setFilters] = useState<Omit<PaginationParams, 'page' | 'limit'>>({});
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: initialPage,
    limit: initialLimit,
    totalPages: 1,
  });

  const loadData = useCallback(async (page: number, currentFilters: Omit<PaginationParams, 'page' | 'limit'>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await catalogueApi.products.getAll({ page, limit: initialLimit, ...currentFilters });

      if ('data' in response && 'meta' in response) {
        setProducts(response.data);
        setPagination(response.meta);
      } else {
        const data = response as ApiProduct[];
        setProducts(data);
        setPagination({
          total: data.length,
          page,
          limit: initialLimit,
          totalPages: Math.ceil(data.length / initialLimit) || 1,
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Error loading products');
    } finally {
      setLoading(false);
    }
  }, [initialLimit]);

  useEffect(() => {
    loadData(currentPage, filters);
  }, [loadData, currentPage, filters]);

  const createProduct = useCallback(async (data: CreateProductDto | { name: string; price: number; costPrice: number; stock?: number; barCode?: string; productImage?: string; category: string }): Promise<ApiProduct> => {
    try {
      setError(null);
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

      const newProduct = await catalogueApi.products.create(createDto);
      await loadData(currentPage, filters);
      return newProduct;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error creating product');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage, filters]);

  const updateProduct = useCallback(async (id: string, data: UpdateProductDto | any): Promise<ApiProduct> => {
    try {
      setError(null);
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

      const updated = await catalogueApi.products.update(id, updateDto);
      await loadData(currentPage, filters);
      return updated;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error updating product');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage, filters]);

  const deleteProduct = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await catalogueApi.products.delete(id);
      await loadData(currentPage, filters);
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const finalError = serverMessage || (err instanceof Error ? err.message : 'Error deleting product');
      setError(finalError);
      throw new Error(finalError);
    }
  }, [loadData, currentPage, filters]);

  const loadPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return {
    products,
    pagination,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    setFilters,
    refresh: () => loadData(currentPage, filters),
    loadPage,
  };
}
