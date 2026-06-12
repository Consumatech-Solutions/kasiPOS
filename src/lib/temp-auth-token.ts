const TEMP_AUTH_TOKEN_KEY = "kasi-pos-temp-token";

export function storeTempAuthToken(token: string): void {
  if (typeof globalThis.sessionStorage === "undefined") return;
  globalThis.sessionStorage.setItem(TEMP_AUTH_TOKEN_KEY, token);
}

export function readTempAuthToken(): string | null {
  if (typeof globalThis.sessionStorage === "undefined") return null;
  return globalThis.sessionStorage.getItem(TEMP_AUTH_TOKEN_KEY);
}

export function clearTempAuthToken(): void {
  if (typeof globalThis.sessionStorage === "undefined") return;
  globalThis.sessionStorage.removeItem(TEMP_AUTH_TOKEN_KEY);
}
