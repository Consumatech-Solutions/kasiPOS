import Link from "next/link";
import { CalendarClock, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DashboardApproachingDueDate } from "@/lib/api/dashboard-stats";
import { formatDashboardCurrency } from "@/lib/dashboard-metrics";
import type { StoreCurrency } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DailyActionsPanelProps {
  approachingDueDates: DashboardApproachingDueDate[];
  currency: StoreCurrency;
  className?: string;
}

export function DailyActionsPanel({
  approachingDueDates,
  currency,
  className,
}: DailyActionsPanelProps) {
  const { t } = useTranslation();
  const today = approachingDueDates[0];
  const tomorrow = approachingDueDates[1];

  if (!today && !tomorrow) {
    return (
      <Card className={cn("flex h-full flex-col", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">
            {t("dashboard.actions.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-muted-foreground">
            {t("dashboard.actions.empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl">
          {t("dashboard.actions.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {today ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Send className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold leading-snug">
              {t("dashboard.actions.recoverToday", {
                amount: formatDashboardCurrency(today.totalAmount, currency),
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("dashboard.actions.recoverTodayMeta", {
                count: today.clientsOwingCount,
              })}
            </p>
          </div>
        ) : null}

        {tomorrow ? (
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold leading-snug">
              {t("dashboard.actions.recoverTomorrow", {
                amount: formatDashboardCurrency(tomorrow.totalAmount, currency),
              })}
            </p>
            <Link
              href="/customers"
              className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
            >
              {t("dashboard.actions.viewCustomers", {
                count: tomorrow.clientsOwingCount,
              })}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
