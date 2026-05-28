import { isSafeTransactionIdForLink } from "@/lib/transaction-utils";

const TRANSACTIONS_PATH = "/transactions";

export function transactionsPendingCreditLink(): string {
  return `${TRANSACTIONS_PATH}?filter=pending-credit`;
}

export function transactionsHighlightLink(transactionId: string): string {
  const trimmed = transactionId.trim();
  if (!trimmed || !isSafeTransactionIdForLink(trimmed)) {
    return transactionsPendingCreditLink();
  }
  const params = new URLSearchParams({ highlight: trimmed });
  return `${TRANSACTIONS_PATH}?${params.toString()}`;
}
