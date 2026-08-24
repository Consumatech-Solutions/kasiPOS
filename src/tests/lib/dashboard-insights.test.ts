import { describe, expect, it } from "vitest";
import {
  getSalesChangePercents,
  getStockAlerts,
  getTopProducts,
} from "@/lib/dashboard-insights";
import type { Transaction } from "@/types";

describe("dashboard-insights", () => {
  it("computes today vs yesterday percent change", () => {
    const result = getSalesChangePercents([
      { date: "Aug 1", total: 100 },
      { date: "Aug 2", total: 125 },
    ]);
    expect(result.todaySalesChangePercent).toBe(25);
  });

  it("splits low and out of stock products", () => {
    const { lowStock, outOfStock } = getStockAlerts([
      { id: "1", name: "Rice", stock: 0 },
      { id: "2", name: "Sugar", stock: 4, lowStockThreshold: 10 },
      { id: "3", name: "Oil", stock: 50 },
    ]);
    expect(outOfStock.map((p) => p.name)).toEqual(["Rice"]);
    expect(lowStock.map((p) => p.name)).toEqual(["Sugar"]);
  });

  it("ranks top products by revenue", () => {
    const txs = [
      {
        storeId: "s1",
        paymentMethod: "Cash",
        total: 30,
        items: [
          {
            productId: "a",
            productName: "A",
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
          },
          {
            productId: "b",
            productName: "B",
            quantity: 2,
            unitPrice: 10,
            totalPrice: 20,
          },
        ],
      },
    ] as Transaction[];

    const top = getTopProducts(txs, [], 2);
    expect(top[0]?.name).toBe("B");
    expect(top[0]?.revenue).toBe(20);
  });
});
