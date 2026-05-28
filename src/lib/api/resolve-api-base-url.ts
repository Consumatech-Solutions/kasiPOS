import {
  BACKEND_PROXY_EXACT_PATHS,
  BACKEND_PROXY_PATHS,
} from "./backend-proxy-paths";

const DEFAULT_BACKEND_ORIGIN = "http://localhost:3001";

const FRONTEND_DEV_ORIGIN_PATTERN = /:\/\/(localhost|127\.0\.0\.1):9002\/?$/i;

/** True when URL points at the Next.js dev server, not the API. */
function isFrontendDevOrigin(url: string): boolean {
  return FRONTEND_DEV_ORIGIN_PATTERN.test(url.replace(/\/$/, ""));
}

/** Strip trailing `/api` from a base URL so origin and prefix stay separate. */
function stripApiPathSuffix(url: string): string {
  return url.endsWith("/api") ? url.slice(0, -4) : url;
}

function getApiOriginFromEnv(): string {
  const fromPublic = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromPublic && !isFrontendDevOrigin(fromPublic)) {
    return stripApiPathSuffix(fromPublic);
  }
  return DEFAULT_BACKEND_ORIGIN;
}

/**
 * Backend host for next.config rewrites (no path prefix). Never use port 9002.
 * In development defaults to localhost:3001 so NEXT_PUBLIC_API_URL can point at
 * staging/production while the dev proxy still hits a local API.
 */
export function getBackendOrigin(): string {
  const explicit = process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "");
  if (explicit && !isFrontendDevOrigin(explicit)) {
    return stripApiPathSuffix(explicit);
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_BACKEND_ORIGIN;
  }

  return getApiOriginFromEnv();
}

/**
 * Global API path prefix (e.g. `/api` when Swagger is at `{origin}/api`).
 * Set NEXT_PUBLIC_API_PATH_PREFIX=/api or use NEXT_PUBLIC_API_URL ending in /api.
 */
export function getApiPathPrefix(): string {
  const explicit = process.env.NEXT_PUBLIC_API_PATH_PREFIX?.trim();
  if (explicit !== undefined && explicit !== "") {
    const normalized = explicit.startsWith("/") ? explicit : `/${explicit}`;
    return normalized.replace(/\/$/, "") || "";
  }

  const fromPublic = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  if (fromPublic.endsWith("/api")) return "/api";

  return "";
}

/** Full API base URL for direct requests (origin + prefix). */
export function getConfiguredApiUrl(): string {
  return `${getApiOriginFromEnv()}${getApiPathPrefix()}`;
}

/**
 * Browser dev: same-origin + Next rewrites. Production: full API URL.
 */
export function resolveApiBaseUrl(): string {
  if (globalThis.window === undefined) {
    return getConfiguredApiUrl();
  }
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_API_PROXY !== "false"
  ) {
    return getApiPathPrefix();
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
    if (base.startsWith("/")) {
      return `${globalThis.window.location.origin.replace(/\/$/, "")}${base}`;
    }
    return base;
  }
  return getConfiguredApiUrl();
}

export type NextRewrite = { source: string; destination: string };

/** Rewrites for next.config.ts — proxies API routes to the real backend. */
export function buildBackendProxyRewrites(): NextRewrite[] {
  const origin = getBackendOrigin();
  const prefix = getApiPathPrefix();

  const exactPaths = BACKEND_PROXY_EXACT_PATHS.map((p) => `${prefix}${p}`);
  const prefixPaths = BACKEND_PROXY_PATHS.map((p) => `${prefix}${p}`);

  const exactRewrites: NextRewrite[] = exactPaths.map((path) => {
    const route = path.startsWith("/") ? path.slice(1) : path;
    return {
      source: `/${route}`,
      destination: `${origin}${path}`,
    };
  });

  const prefixRewrites = prefixPaths.flatMap((path) => {
    const route = path.startsWith("/") ? path.slice(1) : path;
    return [
      {
        source: `/${route}/:path*`,
        destination: `${origin}${path}/:path*`,
      },
      {
        source: `/${route}`,
        destination: `${origin}${path}`,
      },
    ];
  });

  return [...exactRewrites, ...prefixRewrites];
}
