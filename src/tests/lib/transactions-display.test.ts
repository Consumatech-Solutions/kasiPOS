import { describe, it, expect } from "vitest";
import { transactionsFuzzyMatch } from "@/lib/entity-cache";
import type { Transaction } from "@/types";

const creditBase: Transaction = {
  items: [
    {
      productId: "p1",
      productName: "Sac Hermes",
      quantity: 1,
      unitPrice: 20,
      totalPrice: 20,
    },
  ],
  total: 23,
  paymentMethod: "Credit",
  storeId: "store-1",
  status: "pending",
};

describe("transactionsFuzzyMatch", () => {
  it("matches local and server rows when customer ids differ after sync", () => {
    const local: Transaction = {
      ...creditBase,
      id: "local-1",
      customerId: "temp-cust-1",
      createdAt: "2026-05-29T14:48:00.000Z",
    };
    const server: Transaction = {
      ...creditBase,
      id: "550e8400-e29b-41d4-a716-446655440000",
      customerId: "real-cust-uuid",
      createdAt: "2026-05-29T14:48:05.000Z",
    };
    expect(transactionsFuzzyMatch(local, server)).toBe(true);
  });

  it("rejects different totals", () => {
    const local: Transaction = { ...creditBase, total: 23 };
    const server: Transaction = { ...creditBase, total: 50 };
    expect(transactionsFuzzyMatch(local, server)).toBe(false);
  });
});
