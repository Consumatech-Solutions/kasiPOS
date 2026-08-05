import type { UserRole } from "@/types";

/** Routes staff may access (sales-only). */
const STAFF_ALLOWED_PATHS = new Set([
  "/",
  "/sale",
  "/transactions",
  "/profile",
  "/offline",
]);

const MANAGEMENT_ROLES: UserRole[] = ["admin", "store_admin"];
const STORE_ADMIN_ROLES: UserRole[] = ["store_admin"];
const ALL_ROLES: UserRole[] = ["admin", "staff", "store_admin"];

export { MANAGEMENT_ROLES, STORE_ADMIN_ROLES, ALL_ROLES };

export function isPathAllowedForRole(
  pathname: string,
  role: UserRole | undefined
): boolean {
  if (role !== "staff") return true;
  return STAFF_ALLOWED_PATHS.has(pathname);
}

export function getStaffRedirectPath(): string {
  return "/";
}

export function isDashboardAllowedForRole(role: UserRole | undefined): boolean {
  return role === "store_admin";
}

/** Roles allowed to clear / settle pending credit sales. */
export function canManageCreditClearance(role: UserRole | undefined): boolean {
  return role === "store_admin" || role === "admin";
}

export function getPostLoginRedirectPath(role: UserRole | undefined): string {
  return isDashboardAllowedForRole(role) ? "/dashboard" : "/";
}
