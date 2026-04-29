import { db } from "./db";

export async function seedDatabase() {
  await db
    .transaction(
      "rw",
      db.users,
      db.products,
      db.vouchers,
      db.categories,
      db.parcels,
      db.purchaseOrders,
      async () => {
        const voucherToPatch = await db.vouchers
          .where("code")
          .equalsIgnoreCase("SAVE10")
          .first();
        if (voucherToPatch && voucherToPatch.minPurchase !== 5) {
          await db.vouchers.update(voucherToPatch.id!, { minPurchase: 5 });
        }
      }
    )
    .catch((err: Error) => {
      console.error("Failed to seed database:", err);
    });
}
