import type { Transaction, TransactionStatus } from "@/types";
import {
  formatCreditDueLabel,
  isServerTransactionId,
  transactionIdString,
} from "@/lib/transaction-utils";

export function transactionDisplayStatus(
  transaction: Transaction
): TransactionStatus {
  if (transaction.status != null) return transaction.status;
  if (transaction.paymentMethod === "Credit" && !transaction.creditSettledAt) {
    return "pending";
  }
  return "paid";
}

export function isPendingCreditTransaction(transaction: Transaction): boolean {
  if (transaction.paymentMethod !== "Credit") return false;
  if (transaction.creditSettledAt) return false;
  if (transaction.status === "paid") return false;
  if (transaction.status === "failed") return false;
  if (transaction.status === "pending") return true;
  return transaction.status == null;
}

export function creditDueAtFromTransaction(
  transaction: Transaction
): string | null {
  return transaction.creditDueAt ?? transaction.creditDetails?.dueAt ?? null;
}

export function creditDueAtFromCreateResponse(
  transaction: Transaction | undefined
): string | null {
  if (!transaction) return null;
  return creditDueAtFromTransaction(transaction);
}

export function creditDueDateLabel(
  iso: string | null | undefined
): string | null {
  return formatCreditDueLabel(iso ?? null);
}

/** Pending credit with a synced backend UUID (safe to call clear-credit). */
export function canMarkCreditAsPaid(transaction: Transaction): boolean {
  if (!isPendingCreditTransaction(transaction)) return false;
  const id = transactionIdString(transaction.id);
  return id !== "" && isServerTransactionId(id);
}
