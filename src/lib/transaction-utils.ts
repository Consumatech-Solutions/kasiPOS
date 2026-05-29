import { format, isValid, parseISO } from "date-fns";
import { getDb } from "@/lib/db";
import type { Transaction } from "@/types";

const SAFE_TRANSACTION_ID = /^[0-9a-f-]{1,36}$/i;
const SERVER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when id is from the backend (not local/temp/offline placeholders). */
export function isServerTransactionId(id: string | null | undefined): boolean {
  if (id == null || id === "") return false;
  const s = String(id).trim();
  if (/^temp-/i.test(s) || /^local-/i.test(s) || s.startsWith("TXN-")) {
    return false;
  }
  if (SERVER_UUID.test(s)) return true;
  return /^[a-z0-9][a-z0-9-]{3,63}$/i.test(s);
}

export function transactionIdString(
  id: string | number | undefined | null
): string {
  if (id == null || id === "") return "";
  return String(id);
}

export function formatTransactionIdShort(
  id: string | number | undefined | null
): string {
  const s = transactionIdString(id);
  if (!s) return "N/A";
  return s.length > 8 ? s.slice(0, 8) : s;
}

export function isSafeTransactionIdForLink(id: string): boolean {
  return isServerTransactionId(id) || SAFE_TRANSACTION_ID.test(id);
}

/**
 * Resolves the backend transaction UUID for clear-credit and deep links.
 * Uses transaction.id when already synced, otherwise syncIdMapping.
 */
export async function resolveTransactionServerId(
  transaction: Transaction
): Promise<string | null> {
  const id = transactionIdString(transaction.id);
  if (isServerTransactionId(id)) return id;

  if (typeof window === "undefined") return null;

  const lookupKeys = [id, transaction.idempotencyKey]
    .map((k) => (k != null ? String(k).trim() : ""))
    .filter((k) => k !== "");

  const db = getDb();
  for (const key of lookupKeys) {
    const mapping = await db.syncIdMapping.get(key);
    if (mapping?.serverId && isServerTransactionId(mapping.serverId)) {
      return mapping.serverId;
    }
  }

  return null;
}

function parseTransactionDateRaw(raw: string | Date): Date {
  if (typeof raw !== "string") {
    return new Date(raw);
  }
  if (raw.includes("T")) {
    return parseISO(raw);
  }
  return parseISO(`${raw}T12:00:00`);
}

export function parseTransactionDate(transaction: Transaction): Date {
  const raw = transaction.createdAt ?? transaction.date;
  if (raw == null || raw === "") return new Date();
  const parsed = parseTransactionDateRaw(raw);
  return isValid(parsed) ? parsed : new Date();
}

export function formatCreditDueLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = iso.includes("T") ? parseISO(iso) : parseISO(`${iso}T12:00:00`);
    if (!isValid(d)) return iso;
    return format(d, "PPP p");
  } catch {
    return iso;
  }
}
