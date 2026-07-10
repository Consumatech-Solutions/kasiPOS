import { format, isSameDay, parseISO, subDays } from "date-fns";
import { formatMoney } from "@/lib/format-money";
import type { Customer, Transaction, StoreCurrency } from "@/types";

export interface DashboardSummary {
  todaySales: number;
  totalCustomers: number;
  outstandingCredit: number;
  todayOrders: number;
}

export interface CustomerWithCredit {
  id: string;
  name: string;
  contact: string;
  outstandingCredit: number;
}

export interface RecentSaleRow {
  id: string;
  date: Date;
  customerName: string;
  total: number;
  paymentMethod: Transaction["paymentMethod"];
}

export interface SalesTrendPoint {
  date: string;
  total: number;
}

export function formatDashboardCurrency(
  amount: number,
  currency: StoreCurrency = "USD"
): string {
  return formatMoney(amount, currency);
}

export function transactionDate(transaction: Transaction): Date {
  if (transaction.date instanceof Date) {
    return transaction.date;
  }
  if (transaction.createdAt) {
    return parseISO(transaction.createdAt);
  }
  return new Date();
}

function isToday(date: Date, referenceDate: Date = new Date()): boolean {
  return isSameDay(date, referenceDate);
}

export function buildDashboardMetrics(
  customers: Customer[],
  transactions: Transaction[],
  referenceDate: Date = new Date()
): DashboardSummary {
  const todayTransactions = transactions.filter((t) =>
    isToday(transactionDate(t), referenceDate)
  );

  const todaySales = todayTransactions.reduce(
    (sum, t) => sum + Number(t.total ?? 0),
    0
  );

  const outstandingCredit = customers.reduce(
    (sum, c) => sum + Number(c.outstandingCredit ?? 0),
    0
  );

  return {
    todaySales,
    totalCustomers: customers.length,
    outstandingCredit,
    todayOrders: todayTransactions.length,
  };
}

export function getSalesTrendData(
  transactions: Transaction[],
  days = 7,
  referenceDate: Date = new Date()
): SalesTrendPoint[] {
  const dayKeys = Array.from({ length: days }, (_, i) =>
    format(subDays(referenceDate, days - 1 - i), "yyyy-MM-dd")
  );

  const dailySales = transactions.reduce(
    (acc: Record<string, number>, transaction) => {
      const key = format(transactionDate(transaction), "yyyy-MM-dd");
      acc[key] = (acc[key] ?? 0) + Number(transaction.total ?? 0);
      return acc;
    },
    {}
  );

  return dayKeys.map((key) => ({
    date: format(new Date(`${key}T12:00:00`), "MMM d"),
    total: dailySales[key] ?? 0,
  }));
}

export function getCustomersWithCredit(
  customers: Customer[],
  limit = 5
): CustomerWithCredit[] {
  return customers
    .filter((c) => Number(c.outstandingCredit ?? 0) > 0)
    .sort(
      (a, b) =>
        Number(b.outstandingCredit ?? 0) - Number(a.outstandingCredit ?? 0)
    )
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      outstandingCredit: Number(c.outstandingCredit ?? 0),
    }));
}

export function resolveCustomerName(
  transaction: Transaction,
  customersById: Map<string, Customer>
): string {
  const customerId = transaction.customerId ?? transaction.tempCustomerId;
  if (!customerId) {
    return "";
  }
  return customersById.get(String(customerId))?.name ?? "";
}

export function getRecentTransactions(
  transactions: Transaction[],
  customers: Customer[],
  limit = 6,
  walkInLabel = "Walk-in"
): RecentSaleRow[] {
  const customersById = new Map(
    customers.map((c) => [String(c.id), c] as const)
  );

  return [...transactions]
    .sort((a, b) => transactionDate(b).getTime() - transactionDate(a).getTime())
    .slice(0, limit)
    .map((t, index) => {
      const resolvedName = resolveCustomerName(t, customersById);
      return {
        id: t.id ?? t.idempotencyKey ?? `tx-${index}`,
        date: transactionDate(t),
        customerName: resolvedName || walkInLabel,
        total: Number(t.total ?? 0),
        paymentMethod: t.paymentMethod,
      };
    });
}

export function formatDashboardDateTime(date: Date): string {
  return format(date, "MMM d, HH:mm");
}
