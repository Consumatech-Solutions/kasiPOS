export function getPageRoutesToPreload(isLoggedIn: boolean): string[] {
  const appRoutes = [
    "/",
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
  "/request-access",
  "/verify-code",
  "/set-password",
  "/offline",
  "/print-test",
] as const;
