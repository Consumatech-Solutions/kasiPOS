'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) {
      return customers;
    }

    const query = searchQuery.toLowerCase();
    return customers.filter(
      customer =>
        customer.name?.toLowerCase().includes(query) ||
        customer.contact?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const loadCustomers = useCallback(async (page: number = initialPage, limit: number = initialLimit) => {
    try {
      setLoading(true);
      setError(null);

      let response: { data: Customer[] | PaginatedResponse<Customer> };
      try {
        // Try with pagination parameters first
        response = await customersApi.getAll({ page, limit });
      } catch (err: any) {
        // If 400 error, try without pagination parameters (API might not support pagination)
        if (err?.response?.status === 400) {
          console.warn('Pagination not supported, trying without pagination params');
          response = await customersApi.getAll();
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
  }, [initialPage, initialLimit]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const createCustomer = useCallback(async (data: CreateCustomerDto) => {
    try {
      const response = await customersApi.create(data);
      const created = response.data;
      
      // Refresh the list
      await loadCustomers(pagination.page, pagination.limit);
      
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, loadCustomers]);

  const updateCustomer = useCallback(async (id: string, data: UpdateCustomerDto) => {
    try {
      const response = await customersApi.update(id, data);
      const updated = response.data;
      
      // Refresh the list
      await loadCustomers(pagination.page, pagination.limit);
      
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, loadCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      await customersApi.delete(id);
      
      // Refresh the list
      await loadCustomers(pagination.page, pagination.limit);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete customer';
      setError(errorMessage);
      throw err;
    }
  }, [pagination.page, pagination.limit, loadCustomers]);

  return {
    customers: filteredCustomers,
    allCustomers: filteredCustomers,
    pagination,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: () => loadCustomers(pagination.page, pagination.limit),
    loadPage: (page: number) => loadCustomers(page, pagination.limit),
  };
}
