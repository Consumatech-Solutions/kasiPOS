"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import type { SalesTrendPoint } from "@/lib/dashboard-metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface DashboardChartsPanelProps {
  salesTrend: SalesTrendPoint[];
  className?: string;
}

const salesChartConfig = {
  total: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
};

export function DashboardChartsPanel({
  salesTrend,
  className,
}: DashboardChartsPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="text-lg sm:text-xl">
          {t("dashboard.charts.salesTrend.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.charts.salesTrend.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <ChartContainer
          config={salesChartConfig}
          className="h-full min-h-[220px] w-full flex-1 sm:min-h-[260px]"
        >
          <BarChart
            data={salesTrend}
            margin={{ top: 12, right: 12, left: -8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickFormatter={(value) => `R${value}`} width={48} />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
