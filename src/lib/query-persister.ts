import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import {
  QUERY_ROOTS_EXCLUDED_FROM_INDEXEDDB_PERSIST,
  QUERY_ROOTS_PROTECTED_FROM_PERSIST_EVICTION,
} from "@/lib/query-persist-policy";

const QUERY_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";
const MAX_CACHE_SIZE = 5 * 1024 * 1024;

type PersistedQuery = PersistedClient["clientState"]["queries"][number];

function estimateSizeInBytes(serialized: string): number {
  return new Blob([serialized]).size;
}

function getQueryRoot(query: PersistedQuery): string {
  const root = query.queryKey?.[0];
  return typeof root === "string" ? root : "";
}

function getDataUpdatedAt(query: PersistedQuery): number {
  const updatedAt = query.state.dataUpdatedAt;
  return typeof updatedAt === "number" ? updatedAt : 0;
}

function shrinkPersistedClientByDroppingQueries(
  persistedClient: PersistedClient,
  maxCacheSize: number,
): PersistedClient | undefined {
  const queries = persistedClient.clientState.queries.map((query, index) => ({
    query,
    index,
  }));
  const removable = queries
    .filter(
      ({ query }) =>
        !QUERY_ROOTS_PROTECTED_FROM_PERSIST_EVICTION.has(getQueryRoot(query)),
    )
    .map(({ query, index }) => {
      const root = getQueryRoot(query);
      return {
        index,
        root,
        size: estimateSizeInBytes(JSON.stringify(query)),
        updatedAt: getDataUpdatedAt(query),
        evictTier: QUERY_ROOTS_EXCLUDED_FROM_INDEXEDDB_PERSIST.has(root)
          ? 0
          : 1,
      };
    })
    .sort((a, b) => {
      if (a.evictTier !== b.evictTier) return a.evictTier - b.evictTier;
      if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
      return b.size - a.size;
    });

  if (removable.length === 0) return undefined;

  const removedIndexes = new Set<number>();
  for (const candidate of removable) {
    removedIndexes.add(candidate.index);
    const remainingQueries = persistedClient.clientState.queries.filter(
      (_query, index) => !removedIndexes.has(index),
    );
    const candidateClient: PersistedClient = {
      ...persistedClient,
      clientState: {
        ...persistedClient.clientState,
        queries: remainingQueries,
      },
    };
    const serialized = JSON.stringify(candidateClient);
    if (estimateSizeInBytes(serialized) <= maxCacheSize) {
      return candidateClient;
    }
  }
  return undefined;
}

function shrinkPersistedClientIfOversized(
  persistedClient: PersistedClient,
  maxCacheSize: number,
): PersistedClient | undefined {
  const serialized = JSON.stringify(persistedClient);
  if (estimateSizeInBytes(serialized) <= maxCacheSize) {
    return persistedClient;
  }
  return shrinkPersistedClientByDroppingQueries(persistedClient, maxCacheSize);
}

export function createIDBPersister() {
  return {
    persistClient: async (persistedClient: PersistedClient) => {
      if (typeof window === "undefined") return;
      try {
        let serialized = JSON.stringify(persistedClient);
        let sizeInBytes = estimateSizeInBytes(serialized);
        if (sizeInBytes > MAX_CACHE_SIZE) {
          console.warn(
            "Query cache exceeds size limit, pruning oversized entries before persist",
          );
          const prunedClient = shrinkPersistedClientIfOversized(
            persistedClient,
            MAX_CACHE_SIZE,
          );
          if (!prunedClient) {
            console.warn(
              "Query cache still exceeds size limit after pruning, skipping persist",
            );
            return;
          }
          serialized = JSON.stringify(prunedClient);
          sizeInBytes = estimateSizeInBytes(serialized);
          if (sizeInBytes > MAX_CACHE_SIZE) {
            console.warn(
              "Query cache still exceeds size limit after pruning, skipping persist",
            );
            return;
          }
        }
        const db = getDb();
        await db.keyVal.put({ key: QUERY_CACHE_KEY, value: serialized });
      } catch (error) {
        console.error("Error persisting query client:", error);
        throw error;
      }
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      if (typeof window === "undefined") return undefined;
      try {
        const db = getDb();
        const record = await db.keyVal.get(QUERY_CACHE_KEY);
        const serialized = record?.value;
        if (!serialized) return undefined;
        return JSON.parse(serialized) as PersistedClient;
      } catch (error) {
        console.error("Error restoring query client:", error);
        return undefined;
      }
    },

    removeClient: async () => {
      if (typeof window === "undefined") return;
      try {
        const db = getDb();
        await db.keyVal.delete(QUERY_CACHE_KEY);
      } catch (error) {
        console.error("Error removing query client:", error);
      }
    },
  };
}

export async function setupQueryPersistence(queryClient: QueryClient) {
  const persister = createIDBPersister();

  await persistQueryClient({
    queryClient,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    buster: "v1",
  });
}
