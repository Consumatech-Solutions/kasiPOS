import { api } from "./core";
import type { StoreCurrency } from "@/types";
import type { PaginationMeta, PaginatedResponse } from "@/types/pagination";

export type DashboardApproachingDueDate = {
  dueDate: string;
  credits: Array<{ id: string; customerId: string }>;
  clientsOwingCount: number;
  totalAmount: number;
};

export type DashboardCreditRow = {
  id: string;
  clientName: string;
  totalAmount: number;
  dueDate: string;
};

export type DashboardLowStockProduct = {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
};

export type DashboardNoStockProduct = {
  id: string;
  name: string;
  stock: number;
};

export type DashboardProductPerformance = {
  productId: string;
  unitsSold: number;
  revenue: number;
};

export type DashboardStatsResponse = {
  currency: StoreCurrency;
  totalSales: number;
  todaySales: number;
  totalCustomers: number;
  outstandingCredits: number;
  approachingDueDates: DashboardApproachingDueDate[];
  creditsToRecover: PaginatedResponse<DashboardCreditRow>;
  overdueCredits: PaginatedResponse<DashboardCreditRow>;
  lowStockProducts: PaginatedResponse<DashboardLowStockProduct>;
  noStockProducts: PaginatedResponse<DashboardNoStockProduct>;
  mostSoldProducts: DashboardProductPerformance[];
  mostProfitableProduct: DashboardProductPerformance | null;
};

export type GetDashboardStatsParams = {
  page?: number;
  limit?: number;
};

export type { PaginationMeta };

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
