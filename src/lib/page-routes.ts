export function getPageRoutesToPreload(isLoggedIn: boolean): string[] {
  const appRoutes = [
    "/",
    "/dashboard",
    "/catalogue",
    "/customers",
    "/inventory",
    "/transactions",
    "/vouchers",
    "/reports",
    "/settings",
    "/profile",
    "/buy-stock",
    "/buy-stock/cart",
    "/buy-stock/history",
    "/marketplace",
    "/marketplace/orders",
    "/boph",
    "/store-setup",
  ];

  const authRoutes = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/reset-password/verify",
    "/request-access",
    "/verify-code",
    "/set-password",
  ];

  if (isLoggedIn) {
    return appRoutes;
  } else {
    return authRoutes;
  }
}

export const ALL_PAGE_ROUTES = [
  "/",
  "/dashboard",
  "/catalogue",
  "/customers",
  "/inventory",
  "/transactions",
  "/vouchers",
  "/reports",
  "/settings",
  "/profile",
  "/buy-stock",
  "/buy-stock/cart",
  "/buy-stock/history",
  "/marketplace",
  "/marketplace/orders",
  "/boph",
  "/store-setup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/reset-password/verify",
  "/request-access",
  "/verify-code",
  "/set-password",
  "/offline",
  "/print-test",
] as const;
