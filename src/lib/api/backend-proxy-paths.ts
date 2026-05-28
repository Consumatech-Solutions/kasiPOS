/**
 * Exact API paths proxied before prefix routes (see next.config.ts).
 * Needed when a Next.js app route shares the same prefix (e.g. /transactions page).
 */
export const BACKEND_PROXY_EXACT_PATHS = [
  "/transactions/clear-credit",
] as const;

/** API route prefixes proxied to the backend in development (see next.config.ts). */
export const BACKEND_PROXY_PATHS = [
  "/auth",
  "/users",
  "/stores",
  "/settings",
  "/notifications",
  "/transactions",
  "/products",
  "/categories",
  "/customers",
  "/vouchers",
  "/files",
  "/purchase-orders",
  "/stock-adjustments",
  "/parcels",
  "/campaigns",
  "/marketplace",
  "/category-templates",
  "/product-templates",
] as const;
