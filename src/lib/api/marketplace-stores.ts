import { api } from './core';

export type MarketplaceStore = {
  id: string;
  code: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateMarketplaceStoreDto = {
  code: string;
  name: string;
  logoUrl?: string;
  description?: string;
  isActive?: boolean;
};

export type UpdateMarketplaceStoreDto = {
  name?: string;
  logoUrl?: string;
  description?: string;
  isActive?: boolean;
};

export const marketplaceStoresApi = {
  /**
   * Get all marketplace stores
   */
  getAll: (activeOnly?: boolean) => {
    const params = activeOnly !== undefined ? { activeOnly: activeOnly.toString() } : undefined;
    return api.get<MarketplaceStore[]>('/marketplace-stores', {
      params,
    });
  },

  /**
   * Get a marketplace store by ID
   */
  getById: (id: string) => {
    return api.get<MarketplaceStore>(`/marketplace-stores/${id}`);
  },

  /**
   * Get a marketplace store by code
   */
  getByCode: (code: string) => {
    return api.get<MarketplaceStore>(`/marketplace-stores/code/${code}`);
  },

  /**
   * Create a new marketplace store
   */
  create: (data: CreateMarketplaceStoreDto) => {
    return api.post<MarketplaceStore>('/marketplace-stores', data);
  },

  /**
   * Update a marketplace store
   */
  update: (id: string, data: UpdateMarketplaceStoreDto) => {
    return api.patch<MarketplaceStore>(`/marketplace-stores/${id}`, data);
  },

  /**
   * Delete a marketplace store
   */
  delete: (id: string) => {
    return api.delete(`/marketplace-stores/${id}`);
  },
};
