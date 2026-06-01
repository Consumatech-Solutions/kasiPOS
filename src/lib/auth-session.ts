const AUTH_PATH_PREFIXES = [
  "/auth/login",
  "/auth/request-otp",
  "/auth/verify-otp",
  "/auth/set-password",
  "/auth/set-password-store-admin",
] as const;

let sessionExpiredHandler: (() => void) | null = null;
let sessionExpiredNotifying = false;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    if (typeof atob !== "function") return null;
    const json = atob(padded);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string): number | null {
  if (!token?.trim()) return null;
  const payload = decodeJwtPayload(token.trim());
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return exp * 1000;
  }
  if (typeof exp === "string" && /^\d+$/.test(exp)) {
    return Number(exp) * 1000;
  }
  return null;
}

export function isJwtFormat(token: string): boolean {
  if (!token?.trim()) return false;
  return token.trim().split(".").length === 3;
}

export function isKasiPosE2eBypass(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem("__kasi_pos_e2e") === "1" ||
      window.sessionStorage.getItem("__kasi_pos_e2e") === "1"
    );
  } catch {
    return false;
  }
}

/** True when the stored access token should trigger logout (expired or unusable). */
export function isAccessTokenInvalidForSession(token: string): boolean {
  if (!token?.trim()) return true;
  if (isKasiPosE2eBypass()) return false;
  if (!isJwtFormat(token)) return true;
  const expMs = getJwtExpiryMs(token);
  if (expMs == null) return false;
  return Date.now() >= expMs;
}

export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  let path = url.split("?")[0];
  try {
    if (path.includes("://")) {
      path = new URL(path).pathname;
    }
  } catch {
    /* use path as-is */
  }
  return AUTH_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.endsWith(prefix)
  );
}

export function clearAuthSessionStorage(theme?: string): void {
  if (typeof window === "undefined") return;
  try {
    let themeToKeep = theme;
    if (themeToKeep === undefined) {
      const item = window.localStorage.getItem("kasi-pos-settings");
      if (item) {
        const parsed = JSON.parse(item) as { theme?: string };
        themeToKeep = parsed.theme ?? "light";
      } else {
        themeToKeep = "light";
      }
    }
    window.localStorage.setItem(
      "kasi-pos-settings",
      JSON.stringify({ theme: themeToKeep })
    );
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("__kasi_pos_e2e");
    window.sessionStorage.removeItem("__kasi_pos_e2e");
  } catch (error) {
    console.error("Error clearing auth session storage", error);
  }
}

export function registerSessionExpiredHandler(
  handler: (() => void) | null
): void {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired(): void {
  if (sessionExpiredNotifying) return;
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem("token")) return;

  sessionExpiredNotifying = true;
  try {
    if (sessionExpiredHandler) {
      sessionExpiredHandler();
    } else {
      clearAuthSessionStorage();
      window.location.replace("/login");
    }
  } finally {
    window.setTimeout(() => {
      sessionExpiredNotifying = false;
    }, 500);
  }
}

export function resetSessionExpiredNotifyGuard(): void {
  sessionExpiredNotifying = false;
}
