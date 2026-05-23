import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";
import { isNetworkErrorLike } from "@/lib/network-error";

export function isBackendConnectionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (err?.code === "ERR_NETWORK" || err?.code === "ECONNREFUSED") return true;
  if (isNetworkErrorLike(error)) return true;
  const message = String(err?.message ?? "").toLowerCase();
  return (
    message.includes("connection refused") ||
    message.includes("err_connection_refused")
  );
}

export function backendUnreachableRecovery(): string {
  const apiUrl = getConfiguredApiUrl();
  return `Start the KasiPOS backend at ${apiUrl} (see Swagger at ${apiUrl}/api), then restart npm run dev if you changed .env.`;
}
