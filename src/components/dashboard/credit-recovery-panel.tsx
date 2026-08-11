"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DashboardCreditRow } from "@/lib/api/dashboard-stats";
import { transactionsApi } from "@/lib/api/transactions";
import { formatDueDateLabel } from "@/lib/dashboard-insights";
import { formatDashboardCurrency } from "@/lib/dashboard-metrics";
import { dashboardStatsKeys } from "@/hooks/use-dashboard-stats";
import { useEffectiveOnline } from "@/hooks/use-effective-online";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import type { StoreCurrency } from "@/types";
import type { PaginationMeta } from "@/types/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface CreditRecoveryPanelProps {
  credits: DashboardCreditRow[];
  meta?: PaginationMeta;
  overdueCredits?: DashboardCreditRow[];
  currency: StoreCurrency;
  canClearCredit?: boolean;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function CreditRecoveryPanel({
  credits,
  meta,
  overdueCredits = [],
  currency,
  canClearCredit = false,
  onPageChange,
  isLoading = false,
  className,
}: CreditRecoveryPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { effectiveOnline } = useEffectiveOnline();
  const [pendingCredit, setPendingCredit] = useState<DashboardCreditRow | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmClear = async () => {
    if (!pendingCredit || submitting) return;
    if (!effectiveOnline) {
      feedback.error(
        t("transactions.clearCredit.offlineTitle"),
        t("transactions.clearCredit.offlineDesc"),
        undefined
      );
      return;
    }

    setSubmitting(true);
    try {
      await transactionsApi.clearCredit(pendingCredit.id);
      await queryClient.invalidateQueries({
        queryKey: dashboardStatsKeys.all,
      });
      feedback.success(
        t("transactions.clearCredit.successTitle"),
        t("transactions.clearCredit.successDesc")
      );
      setPendingCredit(null);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message || err?.message;

      if (status === 401 || status === 403) {
        feedback.error(
          t("transactions.clearCredit.unauthorizedTitle"),
          serverMessage || t("transactions.clearCredit.unauthorizedDesc"),
          undefined,
          { code: ERROR_CODES.APP_UPDATE }
        );
      } else if (status === 404) {
        feedback.error(
          t("transactions.clearCredit.notFoundTitle"),
          serverMessage || t("transactions.clearCredit.notFoundDesc"),
          undefined
        );
      } else {
        feedback.error(
          t("transactions.clearCredit.errorTitle"),
          serverMessage || t("transactions.clearCredit.errorDesc"),
          undefined
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderTable = (
    rows: DashboardCreditRow[],
    emptyKey: string,
    keyPrefix: string,
    overdue = false
  ) => {
    if (rows.length === 0) {
      return (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          {t(emptyKey)}
        </p>
      );
    }

    return (
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">
              {t("dashboard.credit.table.name")}
            </th>
            <th className="px-3 py-2 font-medium">
              {t("dashboard.credit.table.outstanding")}
            </th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">
              {t("dashboard.creditRecover.dueDate")}
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">
                {t("dashboard.creditRecover.clearCredit")}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((credit) => (
            <tr
              key={`${keyPrefix}-${credit.id}`}
              className={cn(
                overdue && "bg-red-500/5 text-red-700 dark:text-red-300"
              )}
            >
              <td className="px-3 py-2 font-medium">{credit.clientName}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatDashboardCurrency(credit.totalAmount, currency)}
              </td>
              <td
                className={cn(
                  "hidden px-3 py-2 sm:table-cell",
                  overdue
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                {formatDueDateLabel(credit.dueDate)}
              </td>
              <td className="px-3 py-2 text-right">
                {canClearCredit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] border-primary/40 text-primary hover:bg-primary"
                    onClick={() => setPendingCredit(credit)}
                  >
                    {t("dashboard.creditRecover.clearCredit")}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="min-h-[36px]"
                  >
                    <Link href="/sale">{t("dashboard.credit.viewAll")}</Link>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <Card className={cn("flex h-full min-h-0 flex-col", className)}>
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl">
              {t("dashboard.creditRecover.title")}
            </CardTitle>
            <Link
              href="/sale"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              {t("dashboard.credit.viewAll")}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto rounded-md border",
              isLoading && "opacity-60"
            )}
          >
            {renderTable(credits, "dashboard.credit.empty", "recover", false)}
          </div>
          {meta && onPageChange && meta.totalPages > 1 ? (
            <Pagination
              meta={meta}
              onPageChange={onPageChange}
              className="shrink-0"
            />
          ) : null}

          {overdueCredits.length > 0 ? (
            <div className="min-h-0 shrink-0">
              <p className="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
                {t("dashboard.creditRecover.overdueTitle")}
              </p>
              <div className="max-h-40 overflow-auto rounded-md border border-red-500/30">
                {renderTable(
                  overdueCredits,
                  "dashboard.creditRecover.overdueEmpty",
                  "overdue",
                  true
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingCredit != null}
        onOpenChange={(open) => {
          if (!open && !submitting) setPendingCredit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("transactions.clearCredit.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("transactions.clearCredit.confirmDesc")}
            </AlertDialogDescription>
            {pendingCredit ? (
              <p className="text-sm text-muted-foreground">
                {t("transactions.clearCredit.confirmMeta", {
                  customer: pendingCredit.clientName,
                  amount: formatDashboardCurrency(
                    pendingCredit.totalAmount,
                    currency
                  ),
                })}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              {t("transactions.clearCredit.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmClear();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("transactions.clearCredit.processing")}
                </>
              ) : (
                t("transactions.clearCredit.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
