import { api } from './core';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

/** POST /stores/role-transfer body: exact strings per backend contract */
export type StoreRoleTransferOldAdminState = 'staff user' | 'deleted';

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

  /**
   * POST /stores/role-transfer — store admin transfers ownership to a staff user of the same store.
   * oldStoreAdminState must be exactly "staff user" or "deleted" (including the space in "staff user").
   * Backend should invalidate sessions for the previous and new store admin so both must sign in for updated roles.
   */
  transferStoreRole: (data: {
    newStoreAdminId: string;
    oldStoreAdminState: StoreRoleTransferOldAdminState;
  }) => api.post<void>('/stores/role-transfer', data),
};
