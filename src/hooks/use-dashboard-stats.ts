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

  const useApiData =
    effectiveOnline && apiQuery.isSuccess && apiQuery.data != null;
  const mergedData = useApiData ? apiQuery.data : localQuery.data;
  const source: DashboardStatsSource = useApiData ? "api" : "dexie";

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
    dataUpdatedAt: useApiData
      ? apiQuery.dataUpdatedAt
      : localQuery.dataUpdatedAt,
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
