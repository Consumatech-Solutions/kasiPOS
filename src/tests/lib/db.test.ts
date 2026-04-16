import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, resetDbInstanceForTests } from "@/lib/db";

const EXPECTED_TABLES = [
  "stores",
  "products",
  "customers",
  "transactions",
  "vouchers",
  "categories",
  "stockAdjustments",
  "parcels",
  "purchaseOrders",
  "users",
  "productImages",
  "keyVal",
  "mutationQueue",
  "syncIdMapping",
  "productCache",
  "transactionCache",
  "categoryCache",
] as const;

describe("KasiPosDexie (client)", () => {
  beforeEach(async () => {
    await resetDbInstanceForTests();
  });

  afterEach(async () => {
    await resetDbInstanceForTests();
  });

  it("getDb returns the same singleton instance", () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it("exposes v17 schema tables", async () => {
    const db = getDb();
    await db.open();
    const names = db.tables.map((t) => t.name).sort();
    for (const n of EXPECTED_TABLES) {
      expect(names).toContain(n);
    }
    expect(names.length).toBeGreaterThanOrEqual(EXPECTED_TABLES.length);
  });

  it("supports put/get on critical tables", async () => {
    const db = getDb();
    await db.open();

    await db.keyVal.put({ key: "t", value: "1" });
    expect((await db.keyVal.get("t"))?.value).toBe("1");

    await db.mutationQueue.add({
      mutationKey: JSON.stringify(["x", "y"]),
      variables: { a: 1 },
      timestamp: Date.now(),
      retries: 0,
    });
    expect(await db.mutationQueue.count()).toBe(1);

    await db.syncIdMapping.put({
      tempId: "temp-1",
      serverId: "srv-1",
      createdAt: Date.now(),
    });
    expect(await db.syncIdMapping.get("temp-1")).toMatchObject({
      serverId: "srv-1",
    });

    await db.productCache.put({
      id: "p1",
      name: "P",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect((await db.productCache.get("p1"))?.name).toBe("P");

    await db.categoryCache.put({
      id: "c1",
      name: "C",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    expect((await db.categoryCache.get("c1"))?.name).toBe("C");

    await db.transactionCache.put({
      id: "t1",
      date: "2020-01-01T00:00:00.000Z",
    });
    expect(await db.transactionCache.get("t1")).toBeDefined();
  });
});
