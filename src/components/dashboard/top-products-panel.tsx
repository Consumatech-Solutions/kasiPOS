import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { EnrichedProductPerformance } from "@/lib/dashboard-stats-view";
import { formatDashboardCurrency } from "@/lib/dashboard-metrics";
import { getProductInitials } from "@/lib/utils/product-initials";
import type { StoreCurrency } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TopProductsPanelProps {
  products: EnrichedProductPerformance[];
  currency: StoreCurrency;
  className?: string;
}

function ProductThumb({ name, imageUrl }: { name: string; imageUrl?: string }) {
  if (imageUrl && !imageUrl.startsWith("blob:")) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="36px"
        />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
      {getProductInitials(name)}
    </div>
  );
}

export function TopProductsPanel({
  products,
  currency,
  className,
}: TopProductsPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="text-base font-semibold sm:text-lg">
          {t("dashboard.topProducts.title")}
        </CardTitle>
        <Link
          href="/reports"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {t("dashboard.topProducts.viewReport")}
        </Link>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto pt-0">
        {products.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            {t("dashboard.topProducts.empty")}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="pb-3 pr-3 font-medium">
                  {t("dashboard.topProducts.product")}
                </th>
                <th className="pb-3 pr-3 font-medium">
                  {t("dashboard.topProducts.revenue")}
                </th>
                <th className="pb-3 text-right font-medium">
                  {t("dashboard.topProducts.units")}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.productId}
                  className="border-t border-border/60"
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb
                        name={product.name}
                        imageUrl={product.imageUrl}
                      />
                      <span className="truncate text-sm text-foreground">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-foreground">
                    {formatDashboardCurrency(product.revenue, currency)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-foreground">
                    {product.unitsSold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

interface TopProductSpotlightProps {
  product: EnrichedProductPerformance | null;
  currency: StoreCurrency;
  className?: string;
}

export function TopProductSpotlight({
  product,
  currency,
  className,
}: TopProductSpotlightProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold sm:text-lg">
          {t("dashboard.topProducts.spotlight")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
        {!product ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            {t("dashboard.topProducts.empty")}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-1 items-stretch gap-3">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
              <p className="text-sm font-semibold leading-snug">
                {product.name}
              </p>
              <p className="text-xl font-bold tabular-nums text-primary sm:text-2xl">
                {formatDashboardCurrency(product.revenue, currency)}
              </p>
              <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {t("dashboard.topProducts.unitsSold", {
                  count: product.unitsSold,
                })}
              </span>
            </div>
            <div className="relative aspect-square w-[42%] max-w-[140px] shrink-0 overflow-hidden rounded-xl bg-muted">
              {product.imageUrl && !product.imageUrl.startsWith("blob:") ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="140px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xl font-bold text-primary">
                  {getProductInitials(product.name)}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
