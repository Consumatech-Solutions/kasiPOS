import type { QueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { updateProductStockInDexie } from "@/lib/entity-cache";
import { productKeys } from "@/hooks/use-catalogue";
import type { TransactionItem } from "@/types";

export function buildSoldQuantityByProduct(
  items: TransactionItem[]
): Map<string, number> {
  const soldQuantityByProduct = new Map<string, number>();
  for (const item of items) {
    const pid = String(item.productId);
    soldQuantityByProduct.set(
      pid,
      (soldQuantityByProduct.get(pid) ?? 0) + item.quantity
    );
  }
  return soldQuantityByProduct;
}

export async function applySoldStockUpdates(
  soldQuantityByProduct: Map<string, number>,
  queryClient: QueryClient
): Promise<void> {
  for (const [pid, soldQty] of soldQuantityByProduct.entries()) {
    const product = await getDb().productCache.get(pid);
    if (!product || typeof product.stock !== "number") continue;

    const newStock = Math.max(0, product.stock - soldQty);
    await updateProductStockInDexie(pid, newStock);

    queryClient.setQueriesData({ queryKey: productKeys.lists() }, (oldData) => {
      const data = oldData as { data?: Array<{ id?: string; stock?: number }> };
      if (!data?.data) return oldData;
      return {
        ...data,
        data: data.data.map((p) =>
          String(p.id) === pid ? { ...p, stock: newStock } : p
        ),
      };
    });
  }
}
