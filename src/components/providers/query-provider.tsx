'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { setupQueryPersistence } from '@/lib/query-persister';
import { mutationQueue } from '@/lib/mutation-queue';

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
              // Don't retry on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
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
              // Don't retry mutations on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
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
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
