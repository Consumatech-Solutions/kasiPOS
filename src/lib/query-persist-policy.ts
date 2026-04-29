import type { Query } from "@tanstack/react-query";

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
