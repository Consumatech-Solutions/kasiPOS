/** Configured backend root (used for errors, offline checks, and SSR). */
export function getConfiguredApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

/**
 * Browser dev: same-origin requests via Next.js rewrites.
 * SSR / production: full backend URL from NEXT_PUBLIC_API_URL.
 */
export function resolveApiBaseUrl(): string {
  return getConfiguredApiUrl();
}
