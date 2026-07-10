"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardStatsApi } from "@/lib/api/dashboard-stats";
import {
  getCustomersFromDexie,
  getTransactionsFromDexie,
} from "@/lib/entity-cache";
import {
  buildDashboardMetrics,
  getCustomersWithCredit,
  getRecentTransactions,
  getSalesTrendData,
  type CustomerWithCredit,
  type RecentSaleRow,
  type SalesTrendPoint,
} from "@/lib/dashboard-metrics";
import {
  enrichCreditCustomers,
  enrichRecentSales,
  mapApiSalesTrend,
  mapApiStatsToSummary,
  paginateCreditCustomersLocally,
  type DashboardApiSummary,
} from "@/lib/dashboard-stats-mapper";
import { isOfflineError } from "@/lib/api/core";
import { isNetworkErrorLike } from "@/lib/network-error";
import type { UserRole } from "@/types";
import type { PaginationMeta } from "@/types/pagination";

export type DashboardStatsSource = "api" | "dexie";

export interface DashboardStatsData {
  summary: DashboardApiSummary;
  salesTrend: SalesTrendPoint[];
  creditCustomers: CustomerWithCredit[];
  creditMeta: PaginationMeta;
  recentSales: RecentSaleRow[];
  source: DashboardStatsSource;
}

interface UseDashboardStatsOptions {
  storeId?: string | null;
  role?: UserRole;
  page?: number;
  limit?: number;
  walkInLabel?: string;
  enabled?: boolean;
}

async function loadDexieDashboardStats(
  storeId: string | null | undefined,
  page: number,
  limit: number,
  walkInLabel: string
): Promise<DashboardStatsData> {
  const [customersResult, transactionsResult] = await Promise.all([
    getCustomersFromDexie(1, 10000, undefined, storeId),
    getTransactionsFromDexie(1, 10000, storeId),
  ]);

  const customers = customersResult.data;
  const transactions = transactionsResult.data;
  const summaryMetrics = buildDashboardMetrics(customers, transactions);

  const allCreditCustomers = getCustomersWithCredit(customers, 10000);
  const paginatedCredit = paginateCreditCustomersLocally(
    allCreditCustomers,
    page,
    limit
  );

  return {
    summary: {
      todaySales: summaryMetrics.todaySales,
      totalSales: transactions.reduce(
        (sum, t) => sum + Number(t.total ?? 0),
        0
      ),
      totalCustomers: summaryMetrics.totalCustomers,
      outstandingCredit: summaryMetrics.outstandingCredit,
    },
    salesTrend: getSalesTrendData(transactions),
    creditCustomers: paginatedCredit.data,
    creditMeta: paginatedCredit.meta,
    recentSales: getRecentTransactions(transactions, customers, 5, walkInLabel),
    source: "dexie",
  };
}

async function loadApiDashboardStats(
  storeId: string | null | undefined,
  page: number,
  limit: number,
  walkInLabel: string
): Promise<DashboardStatsData> {
  const response = await dashboardStatsApi.get({ page, limit });
  const stats = response.data;

  const [creditCustomers, recentSales] = await Promise.all([
    enrichCreditCustomers(stats.customersOnCredit.data, storeId),
    enrichRecentSales(stats.recentSales, storeId, walkInLabel),
  ]);

  return {
    summary: mapApiStatsToSummary(stats),
    salesTrend: mapApiSalesTrend(stats.salesTrend),
    creditCustomers,
    creditMeta: stats.customersOnCredit.meta,
    recentSales,
    source: "api",
  };
}

export function useDashboardStats(options: UseDashboardStatsOptions = {}) {
  const {
    storeId,
    role,
    page = 1,
    limit = 10,
    walkInLabel = "Walk-in",
    enabled = true,
  } = options;

  const isStoreAdmin = role === "store_admin";
  const queryEnabled = enabled && isStoreAdmin && Boolean(storeId);

  return useQuery({
    queryKey: ["dashboardStats", { storeId, page, limit }],
    queryFn: async (): Promise<DashboardStatsData> => {
      try {
        return await loadApiDashboardStats(storeId, page, limit, walkInLabel);
      } catch (error) {
        if (isOfflineError(error) || isNetworkErrorLike(error)) {
          return loadDexieDashboardStats(storeId, page, limit, walkInLabel);
        }
        throw error;
      }
    },
    enabled: queryEnabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isOfflineError(error) || isNetworkErrorLike(error)) return false;
      return failureCount < 2;
    },
  });
}
