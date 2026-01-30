'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { setupQueryPersistence } from '@/lib/query-persister';
import { mutationQueue } from '@/lib/mutation-queue';
import { offlineDetector, isOffline } from '@/lib/offline-detector';

// Optional devtools - only load in development
// Using dynamic import to avoid build-time errors if package is not installed

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'offlineFirst', // Try cache first, then network
            staleTime: 30 * 60 * 1000, // 30 minutes - longer to support offline use
            gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep data in memory longer for offline
            retry: (failureCount, error: any) => {
              // Don't retry if we're offline
              if (isOffline()) {
                return false;
              }
              // Don't retry on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
              }
              // Don't retry on network errors when offline
              if (
                (error?.code === 'ERR_NETWORK' || 
                 error?.message === 'Network Error' ||
                 error?.isOffline ||
                 error?.isNetworkError) &&
                isOffline()
              ) {
                return false;
              }
              // Retry up to 3 times for network errors
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            networkMode: 'offlineFirst',
            retry: (failureCount, error: any) => {
              // Don't retry if we're offline
              if (isOffline()) {
                return false;
              }
              // Don't retry mutations on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
              }
              // Don't retry on network errors when offline
              if (
                (error?.code === 'ERR_NETWORK' || 
                 error?.message === 'Network Error' ||
                 error?.isOffline ||
                 error?.isNetworkError) &&
                isOffline()
              ) {
                return false;
              }
              // Retry mutations up to 2 times
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      })
  );

  useEffect(() => {
    // Setup persistence after mount
    setupQueryPersistence(queryClient).catch((error) => {
      console.error('Failed to setup query persistence:', error);
    });
    
    // Setup mutation queue
    mutationQueue.setQueryClient(queryClient);

    // Subscribe to offline status changes
    // Note: networkMode: 'offlineFirst' already handles offline behavior for queries
    const unsubscribe = offlineDetector.subscribe((isOffline) => {
      if (!isOffline) {
        // When coming back online:
        // Resume any paused mutations
        queryClient.resumePausedMutations();
        // Refetch active queries to get fresh data
        queryClient.refetchQueries();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
