import Link from "next/link";
import type { RecentSaleRow } from "@/lib/dashboard-metrics";
import {
  formatDashboardCurrency,
  formatDashboardDateTime,
} from "@/lib/dashboard-metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const MAX_SALES = 6;

interface RecentSalesPanelProps {
  sales: RecentSaleRow[];
  className?: string;
}

function paymentMethodKey(method: RecentSaleRow["paymentMethod"]): string {
  const normalized = method.toLowerCase().replace(/\s+/g, "");
  return `dashboard.recent.payment.${normalized}`;
}

export function RecentSalesPanel({ sales, className }: RecentSalesPanelProps) {
  const { t } = useTranslation();
  const visibleSales = sales.slice(0, MAX_SALES);

  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="text-lg sm:text-xl">
          {t("dashboard.recent.title")}
        </CardTitle>
        <CardDescription>{t("dashboard.recent.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <ul className="min-h-0 flex-1 divide-y rounded-md border">
          {visibleSales.length === 0 ? (
            <li className="px-2 py-2 text-center text-xs text-muted-foreground">
              {t("dashboard.recent.empty")}
            </li>
          ) : (
            visibleSales.map((sale) => (
              <li
                key={sale.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {sale.customerName}
                  </p>
                  <p className="truncate text-xs leading-tight text-muted-foreground">
                    {formatDashboardDateTime(sale.date)}
                    {" · "}
                    {t(paymentMethodKey(sale.paymentMethod), {
                      defaultValue: sale.paymentMethod,
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold">
                  {formatDashboardCurrency(sale.total)}
                </p>
              </li>
            ))
          )}
          {visibleSales.length > 0 ? (
            <li className="px-2 py-1.5">
              <Link
                href="/transactions"
                className="inline-flex w-full items-center text-xs font-medium text-primary hover:underline"
              >
                {t("dashboard.recent.viewAll")}
              </Link>
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
