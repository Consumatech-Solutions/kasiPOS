import { format, isValid, parseISO } from "date-fns";
import type { Transaction } from "@/types";

/** UUID or numeric Dexie id — safe for query params and display. */
const SAFE_TRANSACTION_ID = /^[0-9a-f-]{1,36}$/i;

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
  return SAFE_TRANSACTION_ID.test(id);
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
