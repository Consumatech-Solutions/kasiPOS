import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildApproachingDueDates,
  enrichDashboardStats,
  isNewDashboardStatsContract,
  unwrapDashboardStatsPayload,
} from "@/lib/dashboard-stats-view";
import type { DashboardStatsResponse } from "@/lib/api/dashboard-stats";
import type { Transaction } from "@/types";

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    productCache: {
      get: vi.fn(async () => undefined),
    },
  }),
}));

vi.mock("@/lib/api/catalogue", () => ({
  catalogueApi: {
    products: {
      getById: vi.fn(async (id: string) => ({
        id,
        name: `Product ${id}`,
        productImage: `https://img.test/${id}.png`,
      })),
    },
  },
}));

const emptyPage = <T>(data: T[] = []) => ({
  data,
  meta: { total: data.length, page: 1, limit: 5, totalPages: 1 },
});

const sampleResponse: DashboardStatsResponse = {
  currency: "USD",
  totalSales: 45000.5,
  todaySales: 1250,
  totalCustomers: 84,
  outstandingCredits: 3200,
  approachingDueDates: [
    {
      dueDate: "2026-08-07",
      credits: [{ id: "tx1", customerId: "c1" }],
      clientsOwingCount: 1,
      totalAmount: 500,
    },
  ],
  creditsToRecover: emptyPage([
    {
      id: "tx1",
      clientName: "Ada",
      totalAmount: 500,
      dueDate: "2026-08-07",
    },
  ]),
  overdueCredits: emptyPage(),
  lowStockProducts: emptyPage([
    { id: "p1", name: "Soap", stock: 2, lowStockThreshold: 5 },
  ]),
  noStockProducts: emptyPage([{ id: "p2", name: "Oil", stock: 0 }]),
  mostSoldProducts: [{ productId: "p1", unitsSold: 12, revenue: 240 }],
  mostProfitableProduct: { productId: "p2", unitsSold: 3, revenue: 900 },
};

describe("dashboard-stats-view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects new vs legacy dashboard-stats contracts", () => {
    expect(isNewDashboardStatsContract(sampleResponse)).toBe(true);
    expect(
      isNewDashboardStatsContract({
        currency: "USD",
        todaySales: 0,
        totalSales: 0,
        totalCustomers: 0,
        outstandingCredits: 0,
        customersOnCredit: { data: [], meta: emptyPage().meta },
        recentSales: [],
        salesTrend: [],
      })
    ).toBe(false);
  });

  it("unwraps nested data payloads", () => {
    expect(
      unwrapDashboardStatsPayload({ data: { todaySales: 12, currency: "USD" } })
    ).toEqual({ todaySales: 12, currency: "USD" });
    expect(unwrapDashboardStatsPayload({ todaySales: 5 })).toEqual({
      todaySales: 5,
    });
  });

  it("enrichDashboardStats maps summary and enriches product names/images", async () => {
    const view = await enrichDashboardStats(sampleResponse);

    expect(view.currency).toBe("USD");
    expect(view.outstandingCredits).toBe(3200);
    expect(view.todaySales).toBe(1250);
    expect(view.totalSales).toBe(45000.5);
    expect(view.totalCustomers).toBe(84);
    expect(view.mostSoldProducts[0]).toMatchObject({
      productId: "p1",
      name: "Product p1",
      imageUrl: "https://img.test/p1.png",
      unitsSold: 12,
    });
    expect(view.mostProfitableProduct).toMatchObject({
      productId: "p2",
      name: "Product p2",
      revenue: 900,
    });
    expect(view.lowStockProducts.data[0].imageUrl).toBe(
      "https://img.test/p1.png"
    );
  });

  it("enrichDashboardStats tolerates legacy API payloads without new lists", async () => {
    const view = await enrichDashboardStats({
      currency: "USD",
      totalSales: 10,
      todaySales: 2,
      totalCustomers: 3,
      outstandingCredits: 4,
      customersOnCredit: {
        data: [],
        meta: { total: 0, page: 1, limit: 5, totalPages: 0 },
      },
      recentSales: [],
      salesTrend: [],
    });

    expect(view.todaySales).toBe(2);
    expect(view.totalSales).toBe(10);
    expect(view.totalCustomers).toBe(3);
    expect(view.outstandingCredits).toBe(4);
    expect(view.approachingDueDates).toEqual([]);
    expect(view.creditsToRecover.data).toEqual([]);
    expect(view.mostSoldProducts).toEqual([]);
    expect(view.mostProfitableProduct).toBeNull();
  });

  it("mapDashboardKpis maps API KPI fields without currency conversion", async () => {
    const { mapDashboardKpis } = await import("@/lib/dashboard-stats-view");
    expect(
      mapDashboardKpis({
        currency: "CDF",
        todaySales: 120,
        totalSales: 5420,
        totalCustomers: 238,
        outstandingCredits: 1240,
      })
    ).toEqual({
      currency: "CDF",
      todaySales: 120,
      totalSales: 5420,
      totalCustomers: 238,
      outstandingCredits: 1240,
    });
  });

  it("buildApproachingDueDates groups upcoming unpaid credit by due date", () => {
    const transactions = [
      {
        id: "a",
        paymentMethod: "Credit",
        status: "pending",
        total: 100,
        customerId: "c1",
        creditDetails: { paymentDate: "2026-08-10T00:00:00.000Z" },
      },
      {
        id: "b",
        paymentMethod: "Credit",
        status: "pending",
        total: 50,
        customerId: "c2",
        creditDetails: { paymentDate: "2026-08-10T00:00:00.000Z" },
      },
      {
        id: "c",
        paymentMethod: "Credit",
        status: "pending",
        total: 75,
        customerId: "c3",
        creditDetails: { paymentDate: "2026-08-11T00:00:00.000Z" },
      },
      {
        id: "d",
        paymentMethod: "Credit",
        status: "paid",
        total: 200,
        customerId: "c4",
        creditDetails: { paymentDate: "2026-08-10T00:00:00.000Z" },
      },
    ] as Transaction[];

    const buckets = buildApproachingDueDates(
      transactions,
      new Date("2026-08-07T12:00:00.000Z")
    );

    expect(buckets).toHaveLength(2);
    expect(buckets[0].clientsOwingCount).toBe(2);
    expect(buckets[0].totalAmount).toBe(150);
    expect(buckets[1].totalAmount).toBe(75);
  });
});
