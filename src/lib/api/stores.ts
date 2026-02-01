import { api } from './core';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

export const storesApi = {
  /**
   * Get current user's store
   */
  getMyStore: () => api.get<Store>('/stores/my-store'),

  /**
   * Get store by ID
   */
  getById: (id: number) => api.get<Store>(`/stores/${id}`),

  /**
   * Create a new store
   */
  create: (data: CreateStoreDto) => api.post<Store>('/stores', data),

  /**
   * Update a store
   */
  update: (id: number, data: UpdateStoreDto) => api.patch<Store>(`/stores/${id}`, data),
};
