import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClassName?: string;
  changePercent?: number | null;
  changeLabel?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName = "bg-primary/10 text-primary",
  changePercent,
  changeLabel,
}: StatCardProps) {
  const hasChange = changePercent != null && Number.isFinite(changePercent);
  const isUp = hasChange && changePercent >= 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tracking-tight">
            {value}
          </p>
          {hasChange ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                isUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {isUp ? "+" : ""}
                {changePercent}%{changeLabel ? ` ${changeLabel}` : ""}
              </span>
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            accentClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
