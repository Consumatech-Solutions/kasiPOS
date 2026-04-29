type ErrorWithNetworkMetadata = {
  isNetworkError?: boolean;
  isOffline?: boolean;
  code?: string;
  name?: string;
  message?: string;
};

export function isNetworkErrorLike(error: unknown): boolean {
  const err = error as ErrorWithNetworkMetadata | null | undefined;
  if (!err) return false;

  if (err.isNetworkError === true || err.isOffline === true) return true;
  if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return true;
  if (err.code === "ETIMEDOUT") return true;
  if (err.name === "NetworkError" || err.name === "OfflineError") return true;

  const message = String(err.message ?? "").toLowerCase();
  return (
    message === "network error" ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  );
}
