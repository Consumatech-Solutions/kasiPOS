import { api } from './core';
import type { 
  ApiCategory, 
  CreateCategoryDto, 
  UpdateCategoryDto,
  ApiProduct,
  CreateProductDto,
  UpdateProductDto
} from '@/types/catalogue';

const API_BASE_PATH = ''; // API endpoints are directly under base URL (e.g., /categories, not /api/categories)

export const catalogueApi = {
  // Categories
  categories: {
    getAll: async (): Promise<ApiCategory[]> => {
      const response = await api.get(`${API_BASE_PATH}/categories`);
      return response.data;
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
    getAll: async (): Promise<ApiProduct[]> => {
      const response = await api.get(`${API_BASE_PATH}/products`);
      return response.data;
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
