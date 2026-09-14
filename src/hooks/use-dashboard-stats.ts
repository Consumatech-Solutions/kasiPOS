"use client";

import { useQuery } from "@tanstack/react-query";
import {
  loadApiDashboardStatsView,
  loadDexieDashboardStatsView,
  type DashboardStatsView,
} from "@/lib/dashboard-stats-view";
import { isDashboardAllowedForRole } from "@/lib/role-permissions";
import { isOfflineError } from "@/lib/api/core";
import { isNetworkErrorLike } from "@/lib/network-error";
import { useEffectiveOnline } from "@/hooks/use-effective-online";
import type { StoreCurrency, UserRole } from "@/types";

export type DashboardStatsSource = "api" | "dexie";

export type DashboardStatsData = DashboardStatsView;

interface UseDashboardStatsOptions {
  storeId?: string | null;
  role?: UserRole;
  page?: number;
  limit?: number;
  /** Used for offline Dexie fallback when API currency is unavailable. */
  fallbackCurrency?: StoreCurrency;
  enabled?: boolean;
}

export const dashboardStatsKeys = {
  /** v2 avoids serving pre-`/dashboard-stats` cache shapes that crash the page. */
  all: ["dashboardStats", "v2"] as const,
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

function mergeUniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of items) {
    const id = key(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }

  return merged;
}

function mergePaginated<T>(
  local: { data: T[]; meta: { page: number; limit: number } } | undefined,
  api: { data: T[]; meta: { page: number; limit: number } } | undefined,
  getKey: (item: T) => string
): {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
} {
  const combined = mergeUniqueBy<T>(
    [...(local?.data ?? []), ...(api?.data ?? [])],
    getKey
  );

  const page = local?.meta.page ?? api?.meta.page ?? 1;
  const limit = local?.meta.limit ?? api?.meta.limit ?? 5;

  return {
    data: combined.slice((page - 1) * limit, page * limit),
    meta: {
      total: combined.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(combined.length / limit) || 0),
    },
  };
}

function mergeApproachingDueDates(
  local: DashboardStatsView["approachingDueDates"] = [],
  api: DashboardStatsView["approachingDueDates"] = []
): DashboardStatsView["approachingDueDates"] {
  const byDate = new Map<
    string,
    DashboardStatsView["approachingDueDates"][number]
  >();

  for (const row of [...local, ...api]) {
    const existing = byDate.get(row.dueDate);

    if (existing) {
      const seen = new Set(existing.credits.map((credit) => credit.id));
      for (const credit of row.credits) {
        if (!seen.has(credit.id)) {
          existing.credits.push(credit);
          seen.add(credit.id);
        }
      }
      existing.clientsOwingCount = new Set(
        existing.credits.map((credit) => credit.customerId)
      ).size;
      existing.totalAmount += row.totalAmount;
      continue;
    }

    byDate.set(row.dueDate, {
      ...row,
      credits: [...row.credits],
      clientsOwingCount: new Set(row.credits.map((credit) => credit.customerId))
        .size,
      totalAmount: row.totalAmount,
    });
  }

  return [...byDate.values()].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  );
}

function mergeProductPerformanceRows(
  local: DashboardStatsView["mostSoldProducts"] = [],
  api: DashboardStatsView["mostSoldProducts"] = []
): DashboardStatsView["mostSoldProducts"] {
  const merged = mergeUniqueBy([...local, ...api], (row) =>
    String(row.productId)
  );

  return merged.sort(
    (a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold
  );
}

function mergeMostProfitableProduct(
  local: DashboardStatsView["mostProfitableProduct"] = null,
  api: DashboardStatsView["mostProfitableProduct"] = null
): DashboardStatsView["mostProfitableProduct"] {
  const rows = mergeProductPerformanceRows(
    local ? [local] : [],
    api ? [api] : []
  );

  return rows[0] ?? null;
}

export function useDashboardStats(options: UseDashboardStatsOptions = {}) {
  const {
    storeId,
    role,
    page = 1,
    limit = 5,
    fallbackCurrency = "USD",
    enabled = true,
  } = options;

  const canViewDashboard = isDashboardAllowedForRole(role);
  const queryEnabled = enabled && canViewDashboard;
  const { effectiveOnline } = useEffectiveOnline();

  const filters = { storeId, page, limit };

  const localQuery = useQuery({
    queryKey: dashboardStatsKeys.local(filters),
    queryFn: () =>
      loadDexieDashboardStatsView(storeId, page, limit, fallbackCurrency),
    enabled: queryEnabled && Boolean(storeId),
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const apiQuery = useQuery({
    queryKey: dashboardStatsKeys.api(filters),
    queryFn: () =>
      loadApiDashboardStatsView(page, limit, {
        storeId,
        fallbackCurrency,
      }),
    enabled: queryEnabled && effectiveOnline,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400 || status === 401 || status === 403) return false;
      if (isOfflineError(error) || isNetworkErrorLike(error)) return false;
      return failureCount < 2;
    },
  });

  const mergedData =
    localQuery.data && apiQuery.data
      ? {
          ...localQuery.data,
          ...apiQuery.data,
          totalSales:
            Number(apiQuery.data.totalSales ?? 0) +
            Number(localQuery.data.offlineOnlySales ?? 0),
          todaySales: Math.max(
            Number(localQuery.data.todaySales ?? 0),
            Number(apiQuery.data.todaySales ?? 0)
          ),
          totalCustomers: Math.max(
            Number(localQuery.data.totalCustomers ?? 0),
            Number(apiQuery.data.totalCustomers ?? 0)
          ),
          outstandingCredits: Math.max(
            Number(localQuery.data.outstandingCredits ?? 0),
            Number(apiQuery.data.outstandingCredits ?? 0)
          ),
          approachingDueDates: mergeApproachingDueDates(
            localQuery.data.approachingDueDates,
            apiQuery.data.approachingDueDates
          ),
          creditsToRecover: mergePaginated(
            localQuery.data.creditsToRecover,
            apiQuery.data.creditsToRecover,
            (row) => String(row.id)
          ),
          overdueCredits: mergePaginated(
            localQuery.data.overdueCredits,
            apiQuery.data.overdueCredits,
            (row) => String(row.id)
          ),
          lowStockProducts: mergePaginated(
            localQuery.data.lowStockProducts,
            apiQuery.data.lowStockProducts,
            (row) => String(row.id)
          ),
          noStockProducts: mergePaginated(
            localQuery.data.noStockProducts,
            apiQuery.data.noStockProducts,
            (row) => String(row.id)
          ),
          mostSoldProducts: mergeProductPerformanceRows(
            localQuery.data.mostSoldProducts,
            apiQuery.data.mostSoldProducts
          ),
          mostProfitableProduct: mergeMostProfitableProduct(
            localQuery.data.mostProfitableProduct,
            apiQuery.data.mostProfitableProduct
          ),
          source: "dexie" as const,
        }
      : (localQuery.data ?? apiQuery.data);
  const source: DashboardStatsSource = localQuery.data ? "dexie" : "api";

  const apiBlocked =
    apiQuery.isError &&
    [400, 401, 403].includes(
      (apiQuery.error as { response?: { status?: number } })?.response
        ?.status ?? 0
    );

  const isLoading =
    (localQuery.isLoading && !localQuery.data && !apiQuery.data) ||
    (effectiveOnline &&
      apiQuery.isLoading &&
      !apiQuery.data &&
      !localQuery.data &&
      !storeId);

  const isError =
    apiBlocked ||
    ((localQuery.isError || (!storeId && apiQuery.isError)) && !mergedData);

  return {
    data: mergedData ? { ...mergedData, source } : undefined,
    dataUpdatedAt: localQuery.dataUpdatedAt ?? apiQuery.dataUpdatedAt,
    isLoading,
    isError,
    error: apiBlocked ? apiQuery.error : (localQuery.error ?? apiQuery.error),
    isFetching: localQuery.isFetching || apiQuery.isFetching,
    refetch: async () => {
      await Promise.all([
        storeId ? localQuery.refetch() : Promise.resolve(),
        effectiveOnline ? apiQuery.refetch() : Promise.resolve(),
      ]);
    },
  };
}
