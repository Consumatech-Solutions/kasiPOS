import { db } from "./db";

export async function seedDatabase() {
  // Note: Stores and Customers are now managed via API only, so we exclude them from IndexedDB transactions
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
        // ----- PATCHES for existing data -----
        // This is a good place for non-destructive patches for existing users.
        const voucherToPatch = await db.vouchers
          .where("code")
          .equalsIgnoreCase("SAVE10")
          .first();
        if (voucherToPatch && voucherToPatch.minPurchase !== 5) {
          console.log("Patching stale voucher data for SAVE10.");
          await db.vouchers.update(voucherToPatch.id!, { minPurchase: 5 });
        }

        // Note: All data should come from the backend API
        // Categories, Products, Customers, Stores, and Users are now managed through the API
        // No mock data seeding is performed - the application relies on real backend data
      },
    )
    .catch((err: Error) => {
      console.error("Failed to seed database:", err);
    });
}
