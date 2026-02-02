import { api } from './core';
import type {
  ApiCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  ApiProduct,
  CreateProductDto,
  UpdateProductDto
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
  },
};
