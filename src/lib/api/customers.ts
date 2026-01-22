import { api } from './core';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export const customersApi = {
  /**
   * Get all customers with pagination
   */
  getAll: (params?: PaginationParams) => {
    // Use axios params option - only include params if they are provided
    const requestParams: Record<string, number> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    
    return api.get<PaginatedResponse<Customer> | Customer[]>('/customers', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined
    });
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
