import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildApproachingDueDates,
  enrichDashboardStats,
  isNewDashboardStatsContract,
  resolveProductDetails,
  unwrapDashboardStatsPayload,
} from "@/lib/dashboard-stats-view";
import type { DashboardStatsResponse } from "@/lib/api/dashboard-stats";
import type { Transaction } from "@/types";

const productCacheGetMock = vi.fn(async () => undefined);
const productCacheToArrayMock = vi.fn(async () => []);
const transactionCacheToArrayMock = vi.fn(async () => []);

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    productCache: {
      get: productCacheGetMock,
      toArray: productCacheToArrayMock,
    },
    transactionCache: {
      toArray: transactionCacheToArrayMock,
    },
  }),
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
  mostSoldProducts: [
    { productId: "p1", name: "Sugar 1kg", unitsSold: 12, revenue: 240 },
  ],
  mostProfitableProduct: {
    productId: "p2",
    name: "Sugar 1kg",
    unitsSold: 3,
    revenue: 900,
  },
};

describe("dashboard-stats-view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productCacheGetMock.mockResolvedValue(undefined);
    productCacheToArrayMock.mockResolvedValue([]);
    transactionCacheToArrayMock.mockResolvedValue([]);
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

  it("enrichDashboardStats maps summary and uses product name from stats payload", async () => {
    const view = await enrichDashboardStats(sampleResponse);

    expect(view.currency).toBe("USD");
    expect(view.outstandingCredits).toBe(3200);
    expect(view.todaySales).toBe(1250);
    expect(view.totalSales).toBe(45000.5);
    expect(view.totalCustomers).toBe(84);
    expect(view.mostSoldProducts[0]).toMatchObject({
      productId: "p1",
      name: "Sugar 1kg",
      unitsSold: 12,
    });
    expect(view.mostProfitableProduct).toMatchObject({
      productId: "p2",
      name: "Sugar 1kg",
      revenue: 900,
    });
    expect(view.lowStockProducts.data[0].name).toBe("Soap");
    expect(view.noStockProducts.data[0].name).toBe("Oil");
  });

  it("prefers current product name from products over API name", async () => {
    productCacheToArrayMock.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Sugar 2kg",
        productImage: "https://img.test/p1.png",
      },
    ]);

    const view = await enrichDashboardStats(sampleResponse);

    expect(view.mostSoldProducts[0]).toMatchObject({
      name: "Sugar 2kg",
      imageUrl: "https://img.test/p1.png",
    });
  });

  it("falls back to sale line productName when the product is gone", async () => {
    transactionCacheToArrayMock.mockResolvedValueOnce([
      {
        items: [
          {
            productId: "gone-1",
            productName: "Old Sugar",
            imageUrl: "https://img.test/gone-1.png",
          },
        ],
      },
    ]);

    const view = await enrichDashboardStats({
      ...sampleResponse,
      mostSoldProducts: [
        { productId: "gone-1", unitsSold: 52, revenue: 26000 },
      ],
      mostProfitableProduct: {
        productId: "gone-1",
        unitsSold: 52,
        revenue: 26000,
      },
    });

    expect(view.mostSoldProducts[0]).toMatchObject({
      name: "Old Sugar",
      imageUrl: "https://img.test/gone-1.png",
    });
    expect(view.mostProfitableProduct?.name).toBe("Old Sugar");
  });

  it("uses Unknown product when products and sale line names are missing", async () => {
    const view = await enrichDashboardStats({
      ...sampleResponse,
      mostSoldProducts: [{ productId: "missing-1", unitsSold: 1, revenue: 1 }],
      mostProfitableProduct: null,
    });

    expect(view.mostSoldProducts[0].name).toBe("Unknown product");
  });

  it("resolveProductDetails reads sale line productName from cached transactions", async () => {
    transactionCacheToArrayMock.mockResolvedValueOnce([
      {
        items: [
          {
            productId: "p-tx-1",
            productName: "Transaction Product",
            imageUrl: "https://img.test/p-tx-1.png",
          },
        ],
      },
    ]);

    const details = await resolveProductDetails(["p-tx-1"]);

    expect(details.get("p-tx-1")?.fromSaleLine).toMatchObject({
      name: "Transaction Product",
      imageUrl: "https://img.test/p-tx-1.png",
    });
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
