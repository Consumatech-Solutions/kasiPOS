import { api } from './core';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

export const storesApi = {
  /**
   * Récupérer le magasin de l'utilisateur actuel
   */
  getMyStore: () => api.get<Store>('/stores/my-store'),

  /**
   * Récupérer un magasin par ID
   */
  getById: (id: number) => api.get<Store>(`/stores/${id}`),

  /**
   * Créer un nouveau magasin
   */
  create: (data: CreateStoreDto) => api.post<Store>('/stores', data),

  /**
   * Mettre à jour un magasin
   */
  update: (id: number, data: UpdateStoreDto) => api.patch<Store>(`/stores/${id}`, data),
};
