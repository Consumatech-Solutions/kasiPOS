'use client';

import { useState, useEffect, useCallback } from 'react';
import { customersApi } from '@/lib/api/customers';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginationMeta, PaginatedResponse } from '@/types/pagination';

interface UseCustomersOptions {
  initialPage?: number;
  initialLimit?: number;
  searchQuery?: string;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { initialPage = 1, initialLimit = 10, searchQuery = '' } = options;
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: initialPage,
    limit: initialLimit,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async (page: number = initialPage, limit: number = initialLimit, search: string = searchQuery) => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params: { page?: number; limit?: number; search?: string } = {};
      if (page !== undefined) params.page = page;
      if (limit !== undefined) params.limit = limit;
      if (search?.trim()) params.search = search.trim();

      let response: { data: Customer[] | PaginatedResponse<Customer> };
      try {
        // Try with pagination and search parameters
        response = await customersApi.getAll(params);
      } catch (err: any) {
        // If 400 error, try without pagination parameters (API might not support pagination)
        if (err?.response?.status === 400) {
          console.warn('Pagination not supported, trying without pagination params');
          response = await customersApi.getAll(search?.trim() ? { search: search.trim() } : undefined);
        } else {
          throw err;
        }
      }
      
      // Handle both paginated and non-paginated responses
      const responseData = response.data;
      
      // Type guard to check if it's a paginated response
      const isPaginatedResponse = (data: Customer[] | PaginatedResponse<Customer>): data is PaginatedResponse<Customer> => {
        return !Array.isArray(data) && 'data' in data && 'meta' in data;
      };
      
      if (Array.isArray(responseData)) {
        // Non-paginated response (array directly)
        setCustomers(responseData);
        setPagination({
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        });
      } else if (isPaginatedResponse(responseData)) {
        // Paginated response
        setCustomers(responseData.data);
        setPagination(responseData.meta);
      } else {
        // Fallback: empty response
        setCustomers([]);
        setPagination({
          total: 0,
          page: page,
          limit: limit,
          totalPages: 0,
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load customers';
      setError(errorMessage);
      console.error('Error loading customers:', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        params: err?.config?.params,
      });
    } finally {
      setLoading(false);
    }
  }, [initialPage, initialLimit, searchQuery]);

  useEffect(() => {
    loadCustomers(initialPage, initialLimit, searchQuery);
  }, [searchQuery, initialPage, initialLimit, loadCustomers]);

  const createCustomer = useCallback(async (data: CreateCustomerDto) => {
    try {
      const response = await customersApi.create(data);
      const created = response.data;
      
      // Refresh the list with current search query
      await loadCustomers(pagination.page, pagination.limit, searchQuery);
      
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, searchQuery, loadCustomers]);

  const updateCustomer = useCallback(async (id: string, data: UpdateCustomerDto) => {
    try {
      const response = await customersApi.update(id, data);
      const updated = response.data;
      
      // Refresh the list with current search query
      await loadCustomers(pagination.page, pagination.limit, searchQuery);
      
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, searchQuery, loadCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      await customersApi.delete(id);
      
      // Refresh the list with current search query
      await loadCustomers(pagination.page, pagination.limit, searchQuery);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, searchQuery, loadCustomers]);

  return {
    customers,
    allCustomers: customers,
    pagination,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: () => loadCustomers(pagination.page, pagination.limit, searchQuery),
    loadPage: (page: number) => loadCustomers(page, pagination.limit, searchQuery),
  };
}
