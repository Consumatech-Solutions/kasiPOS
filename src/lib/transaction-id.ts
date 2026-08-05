const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is a backend transaction UUID (not a Dexie auto-increment or local temp id). */
export function isTransactionUuid(id: unknown): boolean {
  if (id == null) return false;
  return UUID_RE.test(String(id).trim());
}

/**
 * Resolve the id to send to the backend for a transaction.
 * Dexie `transactions` uses ++id, so local rows may have numeric ids; prefer `serverId` when present.
 */
export function getTransactionApiId(
  transaction: Pick<{ id?: string; serverId?: string }, "id" | "serverId">
): string | null {
  if (isTransactionUuid(transaction.serverId)) {
    return String(transaction.serverId).trim();
  }
  if (isTransactionUuid(transaction.id)) {
    return String(transaction.id).trim();
  }
  return null;
}
