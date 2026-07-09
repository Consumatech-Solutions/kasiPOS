import Link from "next/link";
import type { CustomerWithCredit } from "@/lib/dashboard-metrics";
import { formatDashboardCurrency } from "@/lib/dashboard-metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types/pagination";

interface CreditCustomersPanelProps {
  customers: CustomerWithCredit[];
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function CreditCustomersPanel({
  customers,
  meta,
  onPageChange,
  isLoading = false,
  className,
}: CreditCustomersPanelProps) {
  const { t } = useTranslation();
  const visibleCustomers = customers;

  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="text-lg sm:text-xl">
          {t("dashboard.credit.title")}
        </CardTitle>
        <CardDescription>{t("dashboard.credit.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <ul
          className={cn(
            "min-h-0 flex-1 divide-y rounded-md border",
            isLoading && "opacity-60"
          )}
        >
          {visibleCustomers.length === 0 ? (
            <li className="px-2 py-2 text-center text-xs text-muted-foreground">
              {t("dashboard.credit.empty")}
            </li>
          ) : (
            visibleCustomers.map((customer) => (
              <li
                key={customer.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {customer.name}
                  </p>
                  {customer.contact ? (
                    <p className="truncate text-xs leading-tight text-muted-foreground">
                      {customer.contact}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs font-semibold">
                  {formatDashboardCurrency(customer.outstandingCredit)}
                </p>
              </li>
            ))
          )}
          {visibleCustomers.length > 0 ? (
            <li className="px-2 py-1.5">
              <Link
                href="/customers"
                className="inline-flex w-full items-center text-xs font-medium text-primary hover:underline"
              >
                {t("dashboard.credit.viewAll")}
              </Link>
            </li>
          ) : null}
        </ul>
        {meta && onPageChange && meta.totalPages > 1 ? (
          <Pagination
            meta={meta}
            onPageChange={onPageChange}
            className="mt-3 shrink-0"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
