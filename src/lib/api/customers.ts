import { api } from './core';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export const customersApi = {
  /**
   * Get all customers with pagination and search
   */
  getAll: (params?: PaginationParams) => {
    // Use axios params option - only include params if they are provided
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.search !== undefined && params.search.trim()) {
      requestParams.search = params.search.trim();
    }
    
    return api.get<PaginatedResponse<Customer> | Customer[]>('/customers', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined
    });
  },

  /**
   * Get customer by ID
   */
  getById: (id: string) => {
    return api.get<Customer>(`/customers/${id}`);
  },

  /**
   * Create a new customer
   */
  create: (data: CreateCustomerDto) => {
    return api.post<Customer>('/customers', data);
  },

  /**
   * Update a customer
   */
  update: (id: string, data: UpdateCustomerDto) => {
    return api.patch<Customer>(`/customers/${id}`, data);
  },

  /**
   * Delete a customer
   */
  delete: (id: string) => {
    return api.delete(`/customers/${id}`);
  },
};
