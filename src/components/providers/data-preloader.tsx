'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { catalogueApi } from '@/lib/api/catalogue';
import { customersApi } from '@/lib/api/customers';
import { vouchersApi } from '@/lib/api/vouchers';
import { mutationQueue } from '@/lib/mutation-queue';
import { useToast } from '@/hooks/use-toast';

// Define query keys locally to avoid circular imports from hooks
const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...productKeys.lists(), filters] as const,
};

const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...categoryKeys.lists(), filters] as const,
};

const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string }) => [...customerKeys.lists(), filters] as const,
};

const voucherKeys = {
  all: ['vouchers'] as const,
  lists: () => [...voucherKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; isActive?: boolean }) => [...voucherKeys.lists(), filters] as const,
};

/**
 * DataPreloader - Prefetches essential data on app startup for offline availability
 * 
 * This component runs prefetch queries for:
 * - Products (first 100)
 * - Categories (first 50)
 * - Customers (first 50)
 * - Active vouchers (first 50)
 * 
 * The prefetched data is stored in TanStack Query cache and persisted to IndexedDB,
 * making it available even when the app goes offline.
 */
export function DataPreloader() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Only prefetch when online to avoid errors
    if (typeof window === 'undefined' || !navigator.onLine) {
      return;
    }

    console.log('[DataPreloader] Prefetching essential data for offline use...');
    
    // Set preloading status
    const totalItems = 4; // products, categories, customers, vouchers
    let completed = 0;
    mutationQueue.setPreloadProgress(completed, totalItems);

    const updateProgress = () => {
      completed++;
      mutationQueue.setPreloadProgress(completed, totalItems);
      
      // When all complete, show toast and reset status
      if (completed >= totalItems) {
        setTimeout(() => {
          mutationQueue.setPreloadProgress(totalItems, totalItems);
          toast({
            title: "Offline Mode Ready!",
            description: "All data has been downloaded. You can now work offline",
            duration: 5000,
          });
        }, 500);
      }
    };

    // Prefetch products (first 100 for POS)
    queryClient.prefetchQuery({
      queryKey: productKeys.list({ page: 1, limit: 100 }),
      queryFn: async () => {
        const response = await catalogueApi.products.getAll({ page: 1, limit: 100 });
        // Normalize response to always have data/meta structure
        if ('data' in response && 'meta' in response) {
          return response;
        }
        const data = Array.isArray(response) ? response : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 100, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000, // 30 minutes
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch categories
    queryClient.prefetchQuery({
      queryKey: categoryKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const response = await catalogueApi.categories.getAll({ page: 1, limit: 50 });
        // Normalize response
        if ('data' in response && 'meta' in response) {
          return response;
        }
        const data = Array.isArray(response) ? response : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch recent customers
    queryClient.prefetchQuery({
      queryKey: customerKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const response = await customersApi.getAll({ page: 1, limit: 50 });
        const responseData = response.data;
        // Normalize response
        if (responseData && 'data' in responseData && 'meta' in responseData) {
          return responseData;
        }
        const data = Array.isArray(responseData) ? responseData : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch active vouchers/campaigns
    queryClient.prefetchQuery({
      queryKey: voucherKeys.list({ page: 1, limit: 50, isActive: true }),
      queryFn: async () => {
        const response = await vouchersApi.getAll({ page: 1, limit: 50, isActive: true });
        const responseData = response.data;
        // Normalize response
        if (responseData && 'data' in responseData && 'meta' in responseData) {
          return responseData;
        }
        const data = Array.isArray(responseData) ? responseData : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());
  }, [queryClient, toast]);

  // This component renders nothing - it only prefetches data
  return null;
}
