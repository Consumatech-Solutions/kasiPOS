import { format, parseISO } from "date-fns";
import { customersApi } from "@/lib/api/customers";
import { transactionsApi } from "@/lib/api/transactions";
import type { DashboardStatsResponse } from "@/lib/api/dashboard-stats";
import {
  getCustomersFromDexie,
  getTransactionsFromDexie,
} from "@/lib/entity-cache";
import type {
  CustomerWithCredit,
  RecentSaleRow,
  SalesTrendPoint,
} from "@/lib/dashboard-metrics";
import { resolveCustomerName, transactionDate } from "@/lib/dashboard-metrics";
import type { Customer, Transaction } from "@/types";
import type { PaginationMeta } from "@/types/pagination";

export interface DashboardApiSummary {
  todaySales: number;
  totalSales: number;
  totalCustomers: number;
  outstandingCredit: number;
}

export function mapApiStatsToSummary(
  response: DashboardStatsResponse
): DashboardApiSummary {
  return {
    todaySales: Number(response.todaySales ?? 0),
    totalSales: Number(response.totalSales ?? 0),
    totalCustomers: Number(response.totalCustomers ?? 0),
    outstandingCredit: Number(response.outstandingCredits ?? 0),
  };
}

export function mapApiSalesTrend(
  points: DashboardStatsResponse["salesTrend"]
): SalesTrendPoint[] {
  return points.map((point) => ({
    date: format(parseISO(point.date), "MMM d"),
    total: Number(point.sales ?? 0),
  }));
}

export async function enrichCreditCustomers(
  customerIds: string[],
  storeId?: string | null
): Promise<CustomerWithCredit[]> {
  if (customerIds.length === 0) return [];

  const dexieResult = await getCustomersFromDexie(1, 10000, undefined, storeId);
  const dexieById = new Map(
    dexieResult.data.filter((c) => c.id).map((c) => [String(c.id), c] as const)
  );

  const missingIds = customerIds.filter((id) => !dexieById.has(id));
  const fetched = await Promise.all(
    missingIds.map(async (id) => {
      try {
        const res = await customersApi.getById(id, { storeId });
        return res.data;
      } catch {
        return null;
      }
    })
  );

  for (const customer of fetched) {
    if (customer?.id) {
      dexieById.set(String(customer.id), customer);
    }
  }

  return customerIds
    .map((id) => dexieById.get(id))
    .filter((c): c is Customer => Boolean(c))
    .map((c) => ({
      id: String(c.id),
      name: c.name,
      contact: c.contact,
      outstandingCredit: Number(c.outstandingCredit ?? 0),
    }));
}

export async function enrichRecentSales(
  transactionIds: string[],
  storeId: string | null | undefined,
  walkInLabel: string
): Promise<RecentSaleRow[]> {
  if (transactionIds.length === 0) return [];

  const [dexieTxResult, dexieCustomersResult] = await Promise.all([
    getTransactionsFromDexie(1, 10000, storeId),
    getCustomersFromDexie(1, 10000, undefined, storeId),
  ]);

  const dexieTxById = new Map(
    dexieTxResult.data
      .filter((t) => t.id)
      .map((t) => [String(t.id), t] as const)
  );

  const missingIds = transactionIds.filter((id) => !dexieTxById.has(id));
  const fetched = await Promise.all(
    missingIds.map(async (id) => {
      try {
        const res = await transactionsApi.getById(id, { storeId });
        return res.data;
      } catch {
        return null;
      }
    })
  );

  for (const transaction of fetched) {
    if (transaction?.id) {
      dexieTxById.set(String(transaction.id), transaction);
    }
  }

  const customersById = new Map(
    dexieCustomersResult.data
      .filter((c) => c.id)
      .map((c) => [String(c.id), c] as const)
  );

  return transactionIds
    .map((id, index) => {
      const transaction = dexieTxById.get(id);
      if (!transaction) return null;

      const resolvedName = resolveCustomerName(transaction, customersById);
      return {
        id: String(transaction.id ?? id),
        date: transactionDate(transaction),
        customerName: resolvedName || walkInLabel,
        total: Number(transaction.total ?? 0),
        paymentMethod: transaction.paymentMethod,
      };
    })
    .filter((row): row is RecentSaleRow => row !== null);
}

export function paginateCreditCustomersLocally(
  customers: CustomerWithCredit[],
  page: number,
  limit: number
): { data: CustomerWithCredit[]; meta: PaginationMeta } {
  const total = customers.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;

  return {
    data: customers.slice(start, start + limit),
    meta: {
      total,
      page: safePage,
      limit,
      totalPages,
    },
  };
}

export function buildDexieCreditMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page: Math.min(Math.max(page, 1), totalPages),
    limit,
    totalPages,
  };
}
