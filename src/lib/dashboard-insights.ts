import { format, isSameDay, parseISO, startOfDay, addDays } from "date-fns";
import type { Customer, Product, Transaction } from "@/types";
import {
  transactionDate,
  type CustomerWithCredit,
  type SalesTrendPoint,
} from "@/lib/dashboard-metrics";

export const DEFAULT_DAILY_SALES_GOAL = 15;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const INACTIVE_DAYS = 30;

export type StockAlertRow = {
  id: string;
  name: string;
  stock: number;
  imageUrl?: string;
};

export type TopProductRow = {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  imageUrl?: string;
};

export type CreditRecoveryRow = CustomerWithCredit & {
  dueDate?: string | null;
};

export type DashboardInsights = {
  lowStock: StockAlertRow[];
  outOfStock: StockAlertRow[];
  topProducts: TopProductRow[];
  topProduct: TopProductRow | null;
  todayOrders: number;
  dailyGoal: number;
  recoverTodayAmount: number;
  recoverTodayCount: number;
  recoverTomorrowAmount: number;
  recoverTomorrowCount: number;
  inactiveCustomerCount: number;
  todaySalesChangePercent: number | null;
  weekSalesChangePercent: number | null;
  updatedAt: Date;
};

function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function getSalesChangePercents(
  salesTrend: SalesTrendPoint[]
): Pick<
  DashboardInsights,
  "todaySalesChangePercent" | "weekSalesChangePercent"
> {
  if (salesTrend.length < 2) {
    return { todaySalesChangePercent: null, weekSalesChangePercent: null };
  }
  const today = salesTrend[salesTrend.length - 1]?.total ?? 0;
  const yesterday = salesTrend[salesTrend.length - 2]?.total ?? 0;
  const mid = Math.floor(salesTrend.length / 2);
  const recent = salesTrend
    .slice(mid)
    .reduce((sum, p) => sum + Number(p.total ?? 0), 0);
  const earlier = salesTrend
    .slice(0, mid)
    .reduce((sum, p) => sum + Number(p.total ?? 0), 0);

  return {
    todaySalesChangePercent: percentChange(today, yesterday),
    weekSalesChangePercent: percentChange(recent, earlier),
  };
}

export function getStockAlerts(
  products: Array<
    Pick<Product, "id" | "name" | "stock" | "lowStockThreshold"> & {
      imageUrl?: string;
      productImage?: string;
    }
  >,
  limits = { low: 5, out: 5 }
): { lowStock: StockAlertRow[]; outOfStock: StockAlertRow[] } {
  const mapped = products
    .filter((p) => p.id != null)
    .map((p) => {
      const stock = Number(p.stock ?? 0);
      const threshold =
        typeof p.lowStockThreshold === "number" &&
        Number.isFinite(p.lowStockThreshold)
          ? p.lowStockThreshold
          : DEFAULT_LOW_STOCK_THRESHOLD;
      return {
        id: String(p.id),
        name: p.name,
        stock,
        threshold,
        imageUrl:
          (p as { productImage?: string }).productImage ??
          p.imageUrl ??
          undefined,
      };
    });

  const outOfStock = mapped
    .filter((p) => p.stock <= 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limits.out)
    .map(({ id, name, stock, imageUrl }) => ({ id, name, stock, imageUrl }));

  const lowStock = mapped
    .filter((p) => p.stock > 0 && p.stock <= p.threshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limits.low)
    .map(({ id, name, stock, imageUrl }) => ({ id, name, stock, imageUrl }));

  return { lowStock, outOfStock };
}

export function getTopProducts(
  transactions: Transaction[],
  products: Array<
    Pick<Product, "id" | "name"> & {
      imageUrl?: string;
      productImage?: string;
    }
  >,
  limit = 5
): TopProductRow[] {
  const productsById = new Map(
    products
      .filter((p) => p.id != null)
      .map(
        (p) =>
          [
            String(p.id),
            {
              name: p.name,
              imageUrl:
                (p as { productImage?: string }).productImage ??
                p.imageUrl ??
                undefined,
            },
          ] as const
      )
  );

  const totals = new Map<
    string,
    { name: string; unitsSold: number; revenue: number; imageUrl?: string }
  >();

  for (const tx of transactions) {
    for (const item of tx.items ?? []) {
      const id = String(item.productId);
      const existing = totals.get(id);
      const catalog = productsById.get(id);
      const name = item.productName || catalog?.name || id;
      const imageUrl = item.imageUrl ?? catalog?.imageUrl;
      const units = Number(item.quantity ?? 0);
      const revenue = Number(
        item.totalPrice ?? units * Number(item.unitPrice ?? 0)
      );
      if (existing) {
        existing.unitsSold += units;
        existing.revenue += revenue;
        if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      } else {
        totals.set(id, { name, unitsSold: units, revenue, imageUrl });
      }
    }
  }

  return [...totals.entries()]
    .map(([productId, row]) => ({ productId, ...row }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function creditDueDate(tx: Transaction): Date | null {
  const raw = tx.creditDetails?.paymentDate;
  if (!raw) return null;
  try {
    return parseISO(raw);
  } catch {
    return null;
  }
}

export function getCreditRecoveryBuckets(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): {
  recoverTodayAmount: number;
  recoverTodayCount: number;
  recoverTomorrowAmount: number;
  recoverTomorrowCount: number;
} {
  const todayStart = startOfDay(referenceDate);
  const tomorrowStart = addDays(todayStart, 1);

  let recoverTodayAmount = 0;
  let recoverTodayCount = 0;
  let recoverTomorrowAmount = 0;
  let recoverTomorrowCount = 0;

  for (const tx of transactions) {
    if (tx.paymentMethod !== "Credit") continue;
    const status = String(tx.status ?? "").toLowerCase();
    if (status === "paid" || tx.creditSettledAt) continue;
    const due = creditDueDate(tx);
    if (!due) continue;
    const amount = Number(tx.total ?? 0);
    if (isSameDay(due, todayStart)) {
      recoverTodayAmount += amount;
      recoverTodayCount += 1;
    } else if (isSameDay(due, tomorrowStart)) {
      recoverTomorrowAmount += amount;
      recoverTomorrowCount += 1;
    }
  }

  return {
    recoverTodayAmount,
    recoverTodayCount,
    recoverTomorrowAmount,
    recoverTomorrowCount,
  };
}

export function getInactiveCustomerCount(
  customers: Customer[],
  transactions: Transaction[],
  days = INACTIVE_DAYS,
  referenceDate: Date = new Date()
): number {
  const cutoff = addDays(startOfDay(referenceDate), -days).getTime();
  const lastPurchase = new Map<string, number>();

  for (const tx of transactions) {
    const cid = tx.customerId ?? tx.tempCustomerId;
    if (!cid) continue;
    const ts = transactionDate(tx).getTime();
    const key = String(cid);
    const prev = lastPurchase.get(key) ?? 0;
    if (ts > prev) lastPurchase.set(key, ts);
  }

  return customers.filter((c) => {
    if (!c.id) return false;
    const last = lastPurchase.get(String(c.id));
    if (last == null) return true;
    return last < cutoff;
  }).length;
}

export function enrichCreditRowsWithDueDates(
  customers: CustomerWithCredit[],
  transactions: Transaction[]
): CreditRecoveryRow[] {
  const dueByCustomer = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.paymentMethod !== "Credit") continue;
    const status = String(tx.status ?? "").toLowerCase();
    if (status === "paid" || tx.creditSettledAt) continue;
    const cid = tx.customerId ?? tx.tempCustomerId;
    if (!cid) continue;
    const due = tx.creditDetails?.paymentDate;
    if (!due) continue;
    const key = String(cid);
    const existing = dueByCustomer.get(key);
    if (!existing || due < existing) dueByCustomer.set(key, due);
  }

  return customers.map((c) => ({
    ...c,
    dueDate: dueByCustomer.get(String(c.id)) ?? null,
  }));
}

export function buildDashboardInsights(args: {
  customers: Customer[];
  transactions: Transaction[];
  products: Array<
    Pick<
      Product,
      "id" | "name" | "stock" | "lowStockThreshold" | "imageUrl"
    > & {
      productImage?: string;
    }
  >;
  salesTrend: SalesTrendPoint[];
  todayOrders: number;
  dailyGoal?: number;
  referenceDate?: Date;
}): DashboardInsights {
  const referenceDate = args.referenceDate ?? new Date();
  const { lowStock, outOfStock } = getStockAlerts(args.products);
  const topProducts = getTopProducts(args.transactions, args.products, 5);
  const recovery = getCreditRecoveryBuckets(args.transactions, referenceDate);
  const changes = getSalesChangePercents(args.salesTrend);

  return {
    lowStock,
    outOfStock,
    topProducts,
    topProduct: topProducts[0] ?? null,
    todayOrders: args.todayOrders,
    dailyGoal: args.dailyGoal ?? DEFAULT_DAILY_SALES_GOAL,
    ...recovery,
    inactiveCustomerCount: getInactiveCustomerCount(
      args.customers,
      args.transactions,
      INACTIVE_DAYS,
      referenceDate
    ),
    ...changes,
    updatedAt: referenceDate,
  };
}

export function formatDueDateLabel(dueDate: string | null | undefined): string {
  if (!dueDate) return "—";
  try {
    return format(parseISO(dueDate), "MMM d, yyyy");
  } catch {
    return "—";
  }
}
