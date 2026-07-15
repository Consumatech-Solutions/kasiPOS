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
import { useTranslation } from "react-i18next";
import { useSettings } from "@/components/settings-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { formatDashboardCurrency } from "@/lib/dashboard-metrics";
import { StatCard } from "@/components/dashboard/stat-card";
import { CreditCustomersPanel } from "@/components/dashboard/credit-customers-panel";
import { RecentSalesPanel } from "@/components/dashboard/recent-sales-panel";
import { DashboardChartsPanel } from "@/components/dashboard/dashboard-charts-panel";
import { Button } from "@/components/ui/button";
import { feedback } from "@/lib/feedback";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const storeId = settings.currentStore?.id;
  const role = settings.currentUser?.role;
  const { currency } = useStoreCurrency();
  const [creditPage, setCreditPage] = useState(1);
  const creditLimit = 10;

  const walkInLabel = t("dashboard.recent.walkIn", { defaultValue: "Walk-in" });

  const { data, isLoading, isError, error, refetch, isFetching } =
    useDashboardStats({
      storeId,
      role,
      page: creditPage,
      limit: creditLimit,
      walkInLabel,
    });

  useEffect(() => {
    if (!isError || !error) return;

    const err = error as {
      response?: { status?: number; data?: { message?: string } };
    };
    const status = err?.response?.status;
    const serverMessage = err?.response?.data?.message;

    if (status === 401) {
      feedback.error(
        t("dashboard.page.unauthorized"),
        serverMessage || t("dashboard.page.loadError"),
        undefined
      );
      return;
    }

    if (status === 400) {
      feedback.error(
        t("dashboard.page.loadError"),
        serverMessage || t("dashboard.page.loadError"),
        undefined
      );
    }
  }, [isError, error, t]);

  if (role && role !== "store_admin") {
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
          {t("dashboard.page.loadError")}
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

  const {
    summary,
    salesTrend,
    creditCustomers,
    creditMeta,
    recentSales,
    source,
  } = data;

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
          value={formatDashboardCurrency(summary.todaySales, currency)}
          icon={DollarSign}
        />
        <StatCard
          label={t("dashboard.stats.totalSales")}
          value={formatDashboardCurrency(summary.totalSales, currency)}
          icon={DollarSign}
          accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t("dashboard.stats.totalCustomers")}
          value={String(summary.totalCustomers)}
          icon={Users}
          accentClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label={t("dashboard.stats.outstandingCredit")}
          value={formatDashboardCurrency(summary.outstandingCredit, currency)}
          icon={Wallet}
          accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch lg:gap-6">
        <div className="flex lg:col-span-3 lg:min-h-[380px]">
          <DashboardChartsPanel salesTrend={salesTrend} className="w-full" />
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-2 lg:min-h-[380px]">
          <CreditCustomersPanel
            customers={creditCustomers}
            meta={creditMeta}
            onPageChange={setCreditPage}
            isLoading={isFetching}
            className="flex-1"
          />
          <RecentSalesPanel sales={recentSales} className="flex-1" />
        </aside>
      </div>
    </div>
  );
}
