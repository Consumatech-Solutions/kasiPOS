/** Backend API root (routes are /auth, /settings, etc. — not /api/auth). */
export function getConfiguredApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

/**
 * Browser dev: same-origin requests via Next.js rewrites (see next.config.ts).
 * Production / explicit direct URL: NEXT_PUBLIC_API_URL.
 */
export function resolveApiBaseUrl(): string {
  if (globalThis.window === undefined) {
    return getConfiguredApiUrl();
  }
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_API_PROXY !== "false"
  ) {
    return "";
  }
  return getConfiguredApiUrl();
}

/** URL used for connectivity probes (should match where API traffic goes). */
export function getConnectivityProbeUrl(): string {
  if (globalThis.window !== undefined) {
    const base = resolveApiBaseUrl();
    if (base === "") {
      return globalThis.window.location.origin.replace(/\/$/, "");
    }
    return base;
  }
  return getConfiguredApiUrl();
}
