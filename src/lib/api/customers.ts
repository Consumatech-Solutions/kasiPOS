import { api } from './core';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export const customersApi = {
  /**
   * Récupérer tous les clients avec pagination
   */
  getAll: (params?: PaginationParams) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    return api.get<PaginatedResponse<Customer>>(
      `/customers${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Récupérer un client par ID
   */
  getById: (id: string) => {
    return api.get<Customer>(`/customers/${id}`);
  },

  /**
   * Créer un nouveau client
   */
  create: (data: CreateCustomerDto) => {
    return api.post<Customer>('/customers', data);
  },

  /**
   * Mettre à jour un client
   */
  update: (id: string, data: UpdateCustomerDto) => {
    return api.patch<Customer>(`/customers/${id}`, data);
  },

  /**
   * Supprimer un client
   */
  delete: (id: string) => {
    return api.delete(`/customers/${id}`);
  },
};
