/** Client-side JWT from login; not used for secrets in source control. */
export function getStoredAuthToken(): string | null {
  if (globalThis.window === undefined) return null;
  try {
    return globalThis.window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  if (globalThis.window === undefined) return;
  try {
    globalThis.window.localStorage.setItem("token", token);
  } catch {
    // Ignore quota / private mode errors
  }
}

export function clearStoredAuthToken(): void {
  if (globalThis.window === undefined) return;
  try {
    globalThis.window.localStorage.removeItem("token");
  } catch {
    // Ignore
  }
}
