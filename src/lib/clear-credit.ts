import type { Transaction, UserRole } from "@/types";
import { canManageCreditClearance } from "@/lib/role-permissions";
import { getTransactionApiId } from "@/lib/transaction-id";

export function canClearCreditTransaction(
  role: UserRole | undefined,
  transaction: Pick<
    Transaction,
    "id" | "serverId" | "paymentMethod" | "status" | "creditSettledAt"
  >
): boolean {
  if (!canManageCreditClearance(role)) return false;
  if (!getTransactionApiId(transaction)) return false;
  if (transaction.paymentMethod !== "Credit") return false;
  if (transaction.creditSettledAt) return false;

  const status = String(transaction.status ?? "")
    .trim()
    .toLowerCase();
  if (status === "paid") return false;
  return status === "pending" || status === "";
}
