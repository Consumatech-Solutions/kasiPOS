import { describe, expect, it } from "vitest";
import type { Query } from "@tanstack/react-query";
import {
  shouldDehydrateQueryForIndexedDB,
  shouldPersistQueryRootToIndexedDB,
} from "@/lib/query-persist-policy";

function mockQuery(status: string, root: string): Query {
  return {
    state: { status },
    queryKey: [root, "list"],
  } as unknown as Query;
}

describe("query-persist-policy", () => {
  it("does not persist excluded dehydrate roots", () => {
    for (const root of [
      "products",
      "categories",
      "transactions",
      "marketplaceOrders",
      "parcels",
      "stockAdjustments",
      "vouchers",
      "marketplaceStores",
    ]) {
      expect(shouldPersistQueryRootToIndexedDB(root)).toBe(false);
    }
  });

  it("persists customers and catalogue template roots", () => {
    expect(shouldPersistQueryRootToIndexedDB("customers")).toBe(true);
    expect(shouldPersistQueryRootToIndexedDB("category-templates")).toBe(true);
    expect(shouldPersistQueryRootToIndexedDB("product-templates")).toBe(true);
  });

  it("rejects non-string roots for persist", () => {
    expect(shouldPersistQueryRootToIndexedDB(null)).toBe(false);
    expect(shouldPersistQueryRootToIndexedDB(1)).toBe(false);
  });

  it("shouldDehydrateQueryForIndexedDB requires success status", () => {
    expect(
      shouldDehydrateQueryForIndexedDB(mockQuery("pending", "customers")),
    ).toBe(false);
    expect(
      shouldDehydrateQueryForIndexedDB(mockQuery("success", "customers")),
    ).toBe(true);
    expect(
      shouldDehydrateQueryForIndexedDB(mockQuery("success", "transactions")),
    ).toBe(false);
  });
});
