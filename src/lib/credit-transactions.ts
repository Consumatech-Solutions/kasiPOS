import type { Transaction, TransactionStatus } from "@/types";

export function getTransactionStatus(
  transaction: Transaction
): TransactionStatus {
  if (transaction.status) return transaction.status;
  if (transaction.creditSettledAt) return "paid";
  if (transaction.paymentMethod === "Credit") return "pending";
  return "paid";
}

export function isPendingCreditTransaction(transaction: Transaction): boolean {
  return (
    transaction.paymentMethod === "Credit" &&
    getTransactionStatus(transaction) === "pending"
  );
}

export function getCreditDueAt(transaction: Transaction): string | null {
  return (
    transaction.creditDueAt ??
    transaction.creditDetails?.dueAt ??
    transaction.creditDetails?.paymentDate ??
    null
  );
}
