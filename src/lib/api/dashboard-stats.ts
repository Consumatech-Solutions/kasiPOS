import { api } from "./core";
import type { PaginatedResponse } from "@/types/pagination";

export type DashboardSalesTrendPoint = {
  date: string;
  sales: number;
};

export type DashboardStatsResponse = {
  totalSales: number;
  todaySales: number;
  totalCustomers: number;
  outstandingCredits: number;
  customersOnCredit: PaginatedResponse<string>;
  recentSales: string[];
  salesTrend: DashboardSalesTrendPoint[];
};

export type GetDashboardStatsParams = {
  page?: number;
  limit?: number;
};

export const dashboardStatsApi = {
  get: (params?: GetDashboardStatsParams) => {
    const requestParams: Record<string, number> = {};
    if (params?.page !== undefined) requestParams.page = params.page;
    if (params?.limit !== undefined) requestParams.limit = params.limit;

    return api.get<DashboardStatsResponse>("/dashboard-stats", {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },
};
