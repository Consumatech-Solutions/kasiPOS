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
import { useEffectiveOnline } from "@/hooks/use-effective-online";
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

export const dashboardStatsKeys = {
  all: ["dashboardStats"] as const,
  list: (filters: { storeId?: string | null; page?: number; limit?: number }) =>
    [...dashboardStatsKeys.all, filters] as const,
  local: (filters: {
    storeId?: string | null;
    page?: number;
    limit?: number;
  }) => [...dashboardStatsKeys.list(filters), "local"] as const,
  api: (filters: { storeId?: string | null; page?: number; limit?: number }) =>
    [...dashboardStatsKeys.list(filters), "api"] as const,
};

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
  const { effectiveOnline } = useEffectiveOnline();

  const filters = { storeId, page, limit };

  const localQuery = useQuery({
    queryKey: dashboardStatsKeys.local(filters),
    queryFn: () => loadDexieDashboardStats(storeId, page, limit, walkInLabel),
    enabled: queryEnabled,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  const apiQuery = useQuery({
    queryKey: dashboardStatsKeys.api(filters),
    queryFn: () => loadApiDashboardStats(storeId, page, limit, walkInLabel),
    enabled: queryEnabled && effectiveOnline,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isOfflineError(error) || isNetworkErrorLike(error)) return false;
      return failureCount < 2;
    },
  });

  const useApiData =
    effectiveOnline && apiQuery.isSuccess && apiQuery.data != null;
  const mergedData = useApiData ? apiQuery.data : localQuery.data;
  const source: DashboardStatsSource = useApiData ? "api" : "dexie";

  return {
    data: mergedData ? { ...mergedData, source } : undefined,
    isLoading: localQuery.isLoading && !localQuery.data,
    isError: localQuery.isError && !localQuery.data,
    error: localQuery.error ?? apiQuery.error,
    isFetching: localQuery.isFetching || apiQuery.isFetching,
    refetch: async () => {
      await Promise.all([localQuery.refetch(), apiQuery.refetch()]);
    },
  };
}
