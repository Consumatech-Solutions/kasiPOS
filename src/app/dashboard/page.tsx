"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  DollarSign,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/components/settings-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { formatMoney } from "@/lib/format-money";
import { isDashboardAllowedForRole } from "@/lib/role-permissions";
import { StatCard } from "@/components/dashboard/stat-card";
import { DailyActionsPanel } from "@/components/dashboard/daily-actions-panel";
import { CreditRecoveryPanel } from "@/components/dashboard/credit-recovery-panel";
import { StockAlertsPanel } from "@/components/dashboard/stock-alerts-panel";
import {
  TopProductSpotlight,
  TopProductsPanel,
} from "@/components/dashboard/top-products-panel";
import { Button } from "@/components/ui/button";
import { feedback } from "@/lib/feedback";
import type { StoreCurrency } from "@/types";

function getDashboardErrorMessage(
  error: unknown,
  t: (key: string, opts?: Record<string, string>) => string
): string {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
  };
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.message;

  if (status === 400) {
    return serverMessage || t("dashboard.page.noStore");
  }
  if (status === 401 || status === 403) {
    return serverMessage || t("dashboard.page.unauthorized");
  }
  return serverMessage || t("dashboard.page.loadError");
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const storeId = settings.currentStore?.id;
  const role = settings.currentUser?.role;
  const { currency: storeCurrency } = useStoreCurrency();
  const [creditPage, setCreditPage] = useState(1);
  const creditLimit = 5;

  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDashboardStats({
    storeId,
    role,
    page: creditPage,
    limit: creditLimit,
    fallbackCurrency: storeCurrency,
  });

  useEffect(() => {
    if (!isError || !error) return;
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status === 400 || status === 401 || status === 403) {
      feedback.error(
        t("dashboard.page.loadError"),
        getDashboardErrorMessage(error, t),
        undefined
      );
    }
  }, [isError, error, t]);

  if (role && !isDashboardAllowedForRole(role)) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          {t("dashboard.page.unauthorized")}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("dashboard.page.loading")}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          {getDashboardErrorMessage(error, t)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] touch-target"
          onClick={() => void refetch()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("dashboard.page.retry", { defaultValue: "Try again" })}
        </Button>
      </div>
    );
  }

  // KPI fields from GET /dashboard-stats — amounts already in `currency`.
  const {
    currency: apiCurrency,
    todaySales,
    totalSales,
    totalCustomers,
    outstandingCredits,
    approachingDueDates = [],
    creditsToRecover,
    overdueCredits,
    lowStockProducts,
    noStockProducts,
    mostSoldProducts = [],
    mostProfitableProduct = null,
    source,
  } = data;

  const currency: StoreCurrency = apiCurrency || storeCurrency;
  const canClearCredit = role === "admin" || role === "store_admin";

  const creditsPage = creditsToRecover ?? {
    data: [],
    meta: { total: 0, page: 1, limit: creditLimit, totalPages: 0 },
  };
  const overduePage = overdueCredits ?? {
    data: [],
    meta: { total: 0, page: 1, limit: creditLimit, totalPages: 0 },
  };
  const lowStockPage = lowStockProducts ?? {
    data: [],
    meta: { total: 0, page: 1, limit: creditLimit, totalPages: 0 },
  };
  const noStockPage = noStockProducts ?? {
    data: [],
    meta: { total: 0, page: 1, limit: creditLimit, totalPages: 0 },
  };

  return (
    <div className="space-y-4 p-2 sm:space-y-6 sm:p-4">
      {source === "dexie" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("dashboard.page.offlineFallback")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.stats.todaySales")}
          value={formatMoney(todaySales, currency)}
          icon={DollarSign}
        />
        <StatCard
          label={t("dashboard.stats.totalSales")}
          value={formatMoney(totalSales, currency)}
          icon={DollarSign}
          accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t("dashboard.stats.totalCustomers")}
          value={String(totalCustomers)}
          icon={Users}
          accentClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label={t("dashboard.stats.outstandingCredit")}
          value={formatMoney(outstandingCredits, currency)}
          icon={Wallet}
          accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <DailyActionsPanel
          approachingDueDates={approachingDueDates}
          currency={currency}
        />
        <CreditRecoveryPanel
          credits={creditsPage.data}
          meta={creditsPage.meta}
          overdueCredits={overduePage.data}
          currency={currency}
          canClearCredit={canClearCredit}
          onPageChange={setCreditPage}
          isLoading={isFetching}
        />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap xl:flex-nowrap">
        <StockAlertsPanel
          titleKey="dashboard.stock.lowTitle"
          emptyKey="dashboard.stock.lowEmpty"
          items={lowStockPage.data}
          variant="low"
          className="h-[22.5rem] w-full min-w-0 md:w-[calc(50%-0.5rem)] xl:w-auto xl:flex-[1]"
        />
        <StockAlertsPanel
          titleKey="dashboard.stock.outTitle"
          emptyKey="dashboard.stock.outEmpty"
          items={noStockPage.data}
          variant="out"
          className="h-[22.5rem] w-full min-w-0 md:w-[calc(50%-0.5rem)] xl:w-auto xl:flex-[1]"
        />
        <TopProductsPanel
          products={mostSoldProducts}
          currency={currency}
          className="h-[22.5rem] w-full min-w-0 md:w-[calc(50%-0.5rem)] xl:w-auto xl:flex-[2]"
        />
        <TopProductSpotlight
          product={mostProfitableProduct}
          currency={currency}
          className="h-[22.5rem] w-full min-w-0 md:w-[calc(50%-0.5rem)] xl:w-auto xl:flex-[1]"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.page.lastUpdated", {
          time: format(
            dataUpdatedAt ? new Date(dataUpdatedAt) : new Date(),
            "HH:mm"
          ),
        })}
      </p>
    </div>
  );
}
