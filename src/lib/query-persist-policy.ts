import type { Query } from "@tanstack/react-query";

/**
 * Query key roots we never persist to IndexedDB.
 * Large domains use Dexie and/or refetch as the source of truth; React Query persist stays a narrow slice for cold-start UX.
 */
export const QUERY_ROOTS_EXCLUDED_FROM_INDEXEDDB_PERSIST = new Set<string>([
  "products",
  "categories",
  "transactions",
  "marketplaceOrders",
  "parcels",
  "stockAdjustments",
  "vouchers",
  "marketplaceStores",
]);

/**
 * Roots we avoid dropping when shrinking an oversized persisted blob (whole-query eviction only).
 */
export const QUERY_ROOTS_PROTECTED_FROM_PERSIST_EVICTION = new Set<string>([
  "customers",
  "category-templates",
  "product-templates",
  "store",
  "stores",
  "storeConfig",
  "currentStore",
  "settings",
]);

export function shouldPersistQueryRootToIndexedDB(root: unknown): boolean {
  if (typeof root !== "string") return false;
  return !QUERY_ROOTS_EXCLUDED_FROM_INDEXEDDB_PERSIST.has(root);
}

export function shouldDehydrateQueryForIndexedDB(query: Query): boolean {
  if (query.state.status !== "success") return false;
  return shouldPersistQueryRootToIndexedDB(query.queryKey[0]);
}
