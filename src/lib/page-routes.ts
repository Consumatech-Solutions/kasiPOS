/**
 * Page routes to preload for offline availability
 * 
 * This list includes all pages in the app directory that should be cached
 * for offline use. Auth routes are conditionally included based on login status.
 */

/**
 * Get all page routes to preload based on login status
 * @param isLoggedIn - Whether the user is currently logged in
 * @returns Array of page routes to preload
 */
export function getPageRoutesToPreload(isLoggedIn: boolean): string[] {
  // Core app routes (only preload if logged in)
  const appRoutes = [
    '/', // Home/POS page
    '/catalogue',
    '/customers',
    '/inventory',
    '/transactions',
    '/vouchers',
    '/reports',
    '/settings',
    '/profile',
    '/buy-stock',
    '/buy-stock/cart',
    '/buy-stock/history',
    '/marketplace',
    '/marketplace/orders',
    '/boph',
    '/store-setup',
  ];

  // Auth routes (only preload if NOT logged in)
  const authRoutes = [
    '/login',
    '/request-access',
    '/verify-code',
    '/set-password',
  ];

  if (isLoggedIn) {
    return appRoutes;
  } else {
    return authRoutes;
  }
}

/**
 * All possible page routes (for reference)
 */
export const ALL_PAGE_ROUTES = [
  // App routes
  '/',
  '/catalogue',
  '/customers',
  '/inventory',
  '/transactions',
  '/vouchers',
  '/reports',
  '/settings',
  '/profile',
  '/buy-stock',
  '/buy-stock/cart',
  '/buy-stock/history',
  '/marketplace',
  '/marketplace/orders',
  '/boph',
  '/store-setup',
  // Auth routes
  '/login',
  '/request-access',
  '/verify-code',
  '/set-password',
] as const;

