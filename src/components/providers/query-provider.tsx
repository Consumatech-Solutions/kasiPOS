"use client";

import { QueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "@/lib/query-persister";
import { shouldDehydrateQueryForIndexedDB } from "@/lib/query-persist-policy";
import { mutationQueue } from "@/lib/mutation-queue";
import { offlineDetector, isOffline } from "@/lib/offline-detector";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            staleTime: 30 * 60 * 1000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if (isOffline()) {
                return false;
              }
              if (
                error?.response?.status >= 400 &&
                error?.response?.status < 500
              ) {
                return false;
              }
              if (
                (error?.code === "ERR_NETWORK" ||
                  error?.message === "Network Error" ||
                  error?.isOffline ||
                  error?.isNetworkError) &&
                isOffline()
              ) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            networkMode: "offlineFirst",
            retry: (failureCount, error: any) => {
              if (isOffline()) {
                return false;
              }
              if (
                error?.response?.status >= 400 &&
                error?.response?.status < 500
              ) {
                return false;
              }
              if (
                (error?.code === "ERR_NETWORK" ||
                  error?.message === "Network Error" ||
                  error?.isOffline ||
                  error?.isNetworkError) &&
                isOffline()
              ) {
                return false;
              }
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      })
  );

  useEffect(() => {
    mutationQueue.setQueryClient(queryClient);
    const unsubscribe = offlineDetector.subscribe((offline) => {
      if (!offline) {
        queryClient.resumePausedMutations();
      }
    });
    return () => unsubscribe();
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createIDBPersister(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: "v3",
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydrateQueryForIndexedDB,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
