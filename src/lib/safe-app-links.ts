import { isSafeTransactionIdForLink } from "@/lib/transaction-utils";

const TRANSACTIONS_PATH = "/transactions" as const;
const PENDING_CREDIT_FILTER = "pending-credit" as const;

/** Internal app links only — no protocol-relative or external URLs. */
export function transactionsPendingCreditLink(): string {
  const params = new URLSearchParams({ filter: PENDING_CREDIT_FILTER });
  return `${TRANSACTIONS_PATH}?${params.toString()}`;
}

/** Highlight link when transaction id is validated; otherwise pending-credit list. */
export function transactionsHighlightLink(transactionId: string): string {
  const trimmed = transactionId.trim();
  if (!trimmed || !isSafeTransactionIdForLink(trimmed)) {
    return transactionsPendingCreditLink();
  }
  const params = new URLSearchParams({ highlight: trimmed });
  return `${TRANSACTIONS_PATH}?${params.toString()}`;
}
