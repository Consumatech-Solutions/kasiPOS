import { api } from './core';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

export const storesApi = {
  /**
   * Get current user's store
   */
  getMyStore: () => api.get<Store>('/stores/my-store'),

  /**
   * Get store by ID (UUID string)
   */
  getById: (id: string) => api.get<Store>(`/stores/${id}`),

  /**
   * Create a new store
   */
  create: (data: CreateStoreDto) => api.post<Store>('/stores', data),

  /**
   * Update a store (id: UUID string)
   */
  update: (id: string, data: UpdateStoreDto) => api.patch<Store>(`/stores/${id}`, data),
};
