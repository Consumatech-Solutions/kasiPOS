import { describe, expect, it } from "vitest";
import {
  mapApiSalesTrend,
  mapApiStatsToSummary,
  paginateCreditCustomersLocally,
} from "@/lib/dashboard-stats-mapper";
import type { DashboardStatsResponse } from "@/lib/api/dashboard-stats";

const sampleResponse: DashboardStatsResponse = {
  totalSales: 45000.5,
  todaySales: 1250,
  totalCustomers: 84,
  outstandingCredits: 3200,
  customersOnCredit: {
    data: ["c1", "c2"],
    meta: { total: 12, page: 1, limit: 10, totalPages: 2 },
  },
  recentSales: ["t1", "t2", "t3"],
  salesTrend: [
    { date: "2026-07-02", sales: 0 },
    { date: "2026-07-03", sales: 450.25 },
    { date: "2026-07-04", sales: 1200 },
    { date: "2026-07-05", sales: 0 },
    { date: "2026-07-06", sales: 890.5 },
    { date: "2026-07-07", sales: 2100 },
    { date: "2026-07-08", sales: 1250 },
  ],
};

describe("dashboard-stats-mapper", () => {
  it("mapApiStatsToSummary maps API fields to UI summary", () => {
    const summary = mapApiStatsToSummary(sampleResponse);

    expect(summary.totalSales).toBe(45000.5);
    expect(summary.todaySales).toBe(1250);
    expect(summary.totalCustomers).toBe(84);
    expect(summary.outstandingCredit).toBe(3200);
  });

  it("mapApiSalesTrend maps 7 API points to chart data", () => {
    const trend = mapApiSalesTrend(sampleResponse.salesTrend);

    expect(trend).toHaveLength(7);
    expect(trend[0].total).toBe(0);
    expect(trend[6].total).toBe(1250);
    expect(trend[6].date).toMatch(/Jul/);
  });

  it("paginateCreditCustomersLocally slices customers by page", () => {
    const customers = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i + 1}`,
      name: `Customer ${i + 1}`,
      contact: "",
      outstandingCredit: 100 - i,
    }));

    const page1 = paginateCreditCustomersLocally(customers, 1, 10);
    expect(page1.data).toHaveLength(10);
    expect(page1.meta.total).toBe(12);
    expect(page1.meta.totalPages).toBe(2);

    const page2 = paginateCreditCustomersLocally(customers, 2, 10);
    expect(page2.data).toHaveLength(2);
    expect(page2.meta.page).toBe(2);
  });
});
