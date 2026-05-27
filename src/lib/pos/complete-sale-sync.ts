import { getDb } from "@/lib/db";
import type { Transaction, TransactionItem } from "@/types";

export type SyncValidationResult =
  | { ok: true; map: Map<string, string> }
  | { ok: false; title: string; message: string };

export async function validateSaleSyncMappings(
  items: TransactionItem[],
  customerId?: string | null
): Promise<SyncValidationResult> {
  const mappings = await getDb().syncIdMapping.toArray();
  const map = new Map(mappings.map((m) => [m.tempId, m.serverId]));

  const unresolvedProductIds = items
    .map((item) => String(item.productId))
    .filter((id) => id.startsWith("temp-") && !map.has(id));
  if (unresolvedProductIds.length > 0) {
    return {
      ok: false,
      message:
        "Some products in your cart haven't finished syncing. Please wait a moment and try again.",
      title: "Products still syncing",
    };
  }

  const unresolvedCustomer =
    customerId != null &&
    String(customerId).startsWith("temp-") &&
    !map.has(String(customerId));
  if (unresolvedCustomer) {
    return {
      ok: false,
      message:
        "The selected customer has not finished syncing yet. Please wait a moment and try again.",
      title: "Customer still syncing",
    };
  }

  return { ok: true, map };
}

export function resolveTransactionForApi(
  transaction: Omit<Transaction, "id">,
  map: Map<string, string>
): Omit<Transaction, "id"> {
  const resolvedItems = transaction.items.map((item) => ({
    ...item,
    productId: map.get(String(item.productId)) ?? String(item.productId),
  }));

  const customerId = transaction.customerId;
  const resolvedCustomerId =
    customerId != null && String(customerId).startsWith("temp-")
      ? (map.get(String(customerId)) ?? customerId)
      : customerId;

  return {
    ...transaction,
    items: resolvedItems,
    customerId: resolvedCustomerId,
  };
}
