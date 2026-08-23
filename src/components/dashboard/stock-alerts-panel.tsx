import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { EnrichedStockRow } from "@/lib/dashboard-stats-view";
import { getProductInitials } from "@/lib/utils/product-initials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StockAlertsPanelProps {
  titleKey: string;
  emptyKey: string;
  items: EnrichedStockRow[];
  variant: "low" | "out";
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

export function StockAlertsPanel({
  titleKey,
  emptyKey,
  items,
  variant,
  className,
}: StockAlertsPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold sm:text-lg">
          {t(titleKey)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto pt-0">
        {items.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            {t(emptyKey)}
          </p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href="/catalogue"
              className="flex items-center justify-between gap-2 rounded-md px-1 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ProductThumb name={item.name} imageUrl={item.imageUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {variant === "low" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.stock.remaining", { count: item.stock })}
                    </p>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  variant === "low"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {variant === "low"
                  ? t("dashboard.stock.lowBadge")
                  : t("dashboard.stock.outBadge")}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
