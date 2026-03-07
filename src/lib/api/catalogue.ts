import { api } from './core';
import type {
  ApiCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  ApiProduct,
  CreateProductDto,
  UpdateProductDto,
  ProductTemplate,
  CategoryTemplate,
  AddTemplateRequest,
  AddTemplateProductResponse,
} from '@/types/catalogue';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

const API_BASE_PATH = ''; // API endpoints are directly under base URL (e.g., /categories, not /api/categories)

export const catalogueApi = {
  // Categories
  categories: {
    getAll: async (params?: PaginationParams): Promise<ApiCategory[] | PaginatedResponse<ApiCategory>> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.updatedAtAfter) queryParams.append('updatedAtAfter', params.updatedAtAfter);

      const url = `${API_BASE_PATH}/categories${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);

      // If response has meta, it is paginated
      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiCategory> => {
      const response = await api.get(`${API_BASE_PATH}/categories/${id}`);
      return response.data;
    },

    create: async (data: CreateCategoryDto): Promise<ApiCategory> => {
      const response = await api.post(`${API_BASE_PATH}/categories`, data);
      return response.data;
    },

    update: async (id: string, data: UpdateCategoryDto): Promise<ApiCategory> => {
      const response = await api.patch(`${API_BASE_PATH}/categories/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`${API_BASE_PATH}/categories/${id}`);
    },
  },

  // Products
  products: {
    getAll: async (params?: PaginationParams): Promise<ApiProduct[] | PaginatedResponse<ApiProduct>> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
      if (params?.updatedAtAfter) queryParams.append('updatedAtAfter', params.updatedAtAfter);

      const url = `${API_BASE_PATH}/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);

      // If response has meta, it is paginated
      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiProduct> => {
      const response = await api.get(`${API_BASE_PATH}/products/${id}`);
      return response.data;
    },

    create: async (data: CreateProductDto): Promise<ApiProduct> => {
      const response = await api.post(`${API_BASE_PATH}/products`, data);
      return response.data;
    },

    update: async (id: string, data: UpdateProductDto): Promise<ApiProduct> => {
      const response = await api.patch(`${API_BASE_PATH}/products/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`${API_BASE_PATH}/products/${id}`);
    },

    /** POST /products/add-template. Creates products in the store from the selected templates (does not create or update templates). Auth: Bearer JWT. Body: { items }. */
    addTemplate: async (data: AddTemplateRequest): Promise<AddTemplateProductResponse[]> => {
      const response = await api.post<AddTemplateProductResponse[]>(`${API_BASE_PATH}/products/add-template`, data);
      return Array.isArray(response.data) ? response.data : (response.data as unknown as { data: AddTemplateProductResponse[] })?.data ?? [];
    },
  },

  // Category templates (Admin Portal) with product templates — for Add from templates flow
  categoryTemplates: {
    getAll: async (): Promise<CategoryTemplate[]> => {
      const response = await api.get<CategoryTemplate[] | { data: CategoryTemplate[] }>(
        `${API_BASE_PATH}/category-templates`
      );
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: CategoryTemplate[] })?.data ?? [];
    },
  },

  // Product templates (Admin Portal) for Store Admin
  productTemplates: {
    getAll: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<ProductTemplate[] | { data: ProductTemplate[] }>(
        `${API_BASE_PATH}/product-templates`
      );
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: ProductTemplate[] })?.data ?? [];
    },

    /** GET /product-templates/for-store. Store Admin only. Returns all templates with category/brand for Add Templates flow. */
    getForStore: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<ProductTemplate[]>(`${API_BASE_PATH}/product-templates/for-store`);
      const raw = response.data;
      return Array.isArray(raw) ? raw : [];
    },
  },
};
