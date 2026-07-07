"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getTransactionsFromDexie } from "@/lib/entity-cache";
import type { Transaction } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useSettings } from "@/components/settings-provider";
import { useStoreCurrency } from "@/hooks/use-store-currency";

export default function ReportsPage() {
  const { settings } = useSettings();
  const { formatMoney } = useStoreCurrency();
  const { currentStore } = settings;

  const transactionsQuery = useQuery({
    queryKey: ["reportsTransactions", { storeId: currentStore?.id }],
    queryFn: async () => {
      if (!currentStore) return [];
      const res = await getTransactionsFromDexie(1, 10000, currentStore.id);
      return res.data;
    },
    enabled: !!currentStore?.id,
    staleTime: 0,
  });
  const transactions = transactionsQuery.data ?? [];

  const salesData = useMemo(() => {
    if (!transactions) return [];

    const last7Days = Array.from({ length: 7 }, (_, i) =>
      format(subDays(new Date(), i), "yyyy-MM-dd")
    ).reverse();

    const dailySales = transactions.reduce(
      (acc: Record<string, number>, t: Transaction) => {
        const date = format(t.date ?? new Date(), "yyyy-MM-dd");
        acc[date] = (acc[date] || 0) + t.total;
        return acc;
      },
      {} as Record<string, number>
    );

    return last7Days.map((date) => ({
      date: format(new Date(date), "MMM d"),
      total: dailySales[date] || 0,
    }));
  }, [transactions]);

  const topProducts = useMemo(() => {
    if (!transactions) return [];

    const productSales = transactions
      .flatMap((t) => t.items)
      .reduce(
        (acc: Record<string, number>, item: any) => {
          acc[item.productName] = (acc[item.productName] || 0) + item.quantity;
          return acc;
        },
        {} as Record<string, number>
      );

    return Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, sales]) => ({ name, sales }));
  }, [transactions]);

  const chartConfig = {
    total: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
    sales: {
      label: "Units Sold",
      color: "hsl(var(--accent))",
    },
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
          <CardDescription>Total sales over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              data={salesData}
              margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickFormatter={(value) => formatMoney(value)} />
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>Top 5 products by units sold.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              data={topProducts}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 40, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <XAxis dataKey="sales" type="number" hide />
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar
                dataKey="sales"
                fill="var(--color-sales)"
                radius={4}
                layout="vertical"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
