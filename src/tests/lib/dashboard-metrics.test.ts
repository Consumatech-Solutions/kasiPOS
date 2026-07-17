import { describe, expect, it } from "vitest";
import {
  buildDashboardMetrics,
  formatDashboardCurrency,
  getCustomersWithCredit,
  getRecentTransactions,
  getSalesTrendData,
  resolveCustomerName,
} from "@/lib/dashboard-metrics";
import { formatMoney } from "@/lib/format-money";
import type { Customer, Transaction } from "@/types";

const referenceDate = new Date("2026-07-08T12:00:00.000Z");

const customers: Customer[] = [
  {
    id: "c1",
    name: "Alice",
    contact: "0821111111",
    loyaltyPoints: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    outstandingCredit: 150,
  },
  {
    id: "c2",
    name: "Bob",
    contact: "0822222222",
    loyaltyPoints: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    outstandingCredit: 50,
  },
  {
    id: "c3",
    name: "Carol",
    contact: "0823333333",
    loyaltyPoints: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    outstandingCredit: 0,
  },
];

const transactions: Transaction[] = [
  {
    id: "t1",
    customerId: "c1",
    createdAt: "2026-07-08T09:00:00.000Z",
    items: [],
    total: 100,
    paymentMethod: "Cash",
    storeId: "store-1",
  },
  {
    id: "t2",
    customerId: "c2",
    createdAt: "2026-07-08T10:30:00.000Z",
    items: [],
    total: 75.5,
    paymentMethod: "Credit",
    storeId: "store-1",
  },
  {
    id: "t3",
    createdAt: "2026-07-07T15:00:00.000Z",
    items: [],
    total: 40,
    paymentMethod: "Card",
    storeId: "store-1",
  },
];

describe("dashboard-metrics", () => {
  it("buildDashboardMetrics calculates today sales and orders", () => {
    const metrics = buildDashboardMetrics(
      customers,
      transactions,
      referenceDate
    );

    expect(metrics.todaySales).toBe(175.5);
    expect(metrics.todayOrders).toBe(2);
    expect(metrics.totalCustomers).toBe(3);
    expect(metrics.outstandingCredit).toBe(200);
  });

  it("getCustomersWithCredit sorts by highest outstanding credit", () => {
    const rows = getCustomersWithCredit(customers, 5);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].outstandingCredit).toBe(150);
    expect(rows[1].name).toBe("Bob");
  });

  it("getRecentTransactions resolves customer names and walk-in label", () => {
    const rows = getRecentTransactions(transactions, customers, 6, "Walk-in");

    expect(rows).toHaveLength(3);
    expect(rows[0].customerName).toBe("Bob");
    expect(rows[1].customerName).toBe("Alice");
    expect(rows[2].customerName).toBe("Walk-in");
    expect(rows[0].total).toBe(75.5);
  });

  it("resolveCustomerName returns empty when no customer linked", () => {
    const map = new Map(customers.map((c) => [c.id, c] as const));
    const name = resolveCustomerName(
      {
        items: [],
        total: 10,
        paymentMethod: "Cash",
        storeId: "store-1",
      },
      map
    );

    expect(name).toBe("");
  });

  it("formatDashboardCurrency formats amounts using store currency", () => {
    expect(formatDashboardCurrency(12.5, "ZAR")).toBe(formatMoney(12.5, "ZAR"));
    expect(formatDashboardCurrency(12.5, "USD")).toBe(formatMoney(12.5, "USD"));
    expect(formatDashboardCurrency(12.5, "CDF")).toBe(formatMoney(12.5, "CDF"));
  });

  it("getSalesTrendData returns 7 days of sales totals", () => {
    const trend = getSalesTrendData(transactions, 7, referenceDate);

    expect(trend).toHaveLength(7);
    const todayPoint = trend[trend.length - 1];
    expect(todayPoint.total).toBe(175.5);
  });
});
