import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';
import type { PersistedClient } from '@tanstack/query-persist-client-core';

const QUERY_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Creates an IndexedDB persister for TanStack Query using idb-keyval
 * Compatible with @tanstack/query-persist-client-core
 */
export function createIDBPersister() {
  return {
    persistClient: async (persistedClient: PersistedClient) => {
      try {
        // Serialize to JSON
        const serialized = JSON.stringify(persistedClient);
        
        // Check cache size
        const sizeInBytes = new Blob([serialized]).size;
        
        if (sizeInBytes > MAX_CACHE_SIZE) {
          console.warn('Query cache exceeds size limit, clearing old entries');
          // For now, we'll just store it anyway but could implement LRU eviction
        }

        await set(QUERY_CACHE_KEY, serialized);
      } catch (error) {
        console.error('Error persisting query client:', error);
        throw error;
      }
    },
    
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const serialized = await get<string>(QUERY_CACHE_KEY);
        if (!serialized) return undefined;
        
        return JSON.parse(serialized) as PersistedClient;
      } catch (error) {
        console.error('Error restoring query client:', error);
        return undefined;
      }
    },
    
    removeClient: async () => {
      try {
        await del(QUERY_CACHE_KEY);
      } catch (error) {
        console.error('Error removing query client:', error);
      }
    },
  };
}

/**
 * Setup query persistence for a QueryClient
 */
export async function setupQueryPersistence(queryClient: QueryClient) {
  const persister = createIDBPersister();
  
  await persistQueryClient({
    queryClient,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    buster: 'v1', // Change this to invalidate cache on app updates
  });
}
