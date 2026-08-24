import { parseISO, startOfDay } from "date-fns";
import { dashboardStatsApi } from "@/lib/api/dashboard-stats";
import type {
  DashboardApproachingDueDate,
  DashboardCreditRow,
  DashboardLowStockProduct,
  DashboardProductPerformance,
  DashboardStatsResponse,
} from "@/lib/api/dashboard-stats";
import { buildDashboardMetrics } from "@/lib/dashboard-metrics";
import { getStockAlerts, getTopProducts } from "@/lib/dashboard-insights";
import {
  getCustomersFromDexie,
  getProductsFromDexie,
  getTransactionsFromDexie,
} from "@/lib/entity-cache";
import { getDb } from "@/lib/db";
import type { StoreCurrency, Transaction } from "@/types";
import type { PaginatedResponse, PaginationMeta } from "@/types/pagination";

export type EnrichedProductPerformance = DashboardProductPerformance & {
  name: string;
  imageUrl?: string;
};

export type EnrichedStockRow = {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold?: number;
  imageUrl?: string;
};

export type DashboardStatsView = {
  currency: StoreCurrency;
  /** KPI: paid sales created today (already in `currency`). */
  todaySales: number;
  /** KPI: all paid sales for the store (already in `currency`). */
  totalSales: number;
  /** KPI: non-deleted customers for the store. */
  totalCustomers: number;
  /** KPI: sum of pending credit totals (already in `currency`). */
  outstandingCredits: number;
  approachingDueDates: DashboardApproachingDueDate[];
  creditsToRecover: PaginatedResponse<DashboardCreditRow>;
  overdueCredits: PaginatedResponse<DashboardCreditRow>;
  lowStockProducts: PaginatedResponse<EnrichedStockRow>;
  noStockProducts: PaginatedResponse<EnrichedStockRow>;
  mostSoldProducts: EnrichedProductPerformance[];
  mostProfitableProduct: EnrichedProductPerformance | null;
  source: "api" | "dexie";
};

/** Map API KPI fields — amounts are already in `currency`; do not convert. */
export function mapDashboardKpis(
  raw: Partial<{
    currency: StoreCurrency;
    todaySales: number;
    totalSales: number;
    totalCustomers: number;
    outstandingCredits: number;
  }>
): Pick<
  DashboardStatsView,
  | "currency"
  | "todaySales"
  | "totalSales"
  | "totalCustomers"
  | "outstandingCredits"
> {
  return {
    currency: raw.currency ?? "USD",
    todaySales: Number(raw.todaySales ?? 0),
    totalSales: Number(raw.totalSales ?? 0),
    totalCustomers: Number(raw.totalCustomers ?? 0),
    outstandingCredits: Number(raw.outstandingCredits ?? 0),
  };
}

function emptyMeta(page: number, limit: number): PaginationMeta {
  return { total: 0, page, limit, totalPages: 0 };
}

function emptyPage<T>(page: number, limit: number): PaginatedResponse<T> {
  return { data: [], meta: emptyMeta(page, limit) };
}

/** True when the backend returns the new dashboard-stats contract fields. */
export function isNewDashboardStatsContract(
  raw: Record<string, unknown> | null | undefined
): boolean {
  if (!raw || typeof raw !== "object") return false;
  return (
    Array.isArray(raw.approachingDueDates) ||
    (raw.creditsToRecover != null &&
      typeof raw.creditsToRecover === "object") ||
    (raw.lowStockProducts != null &&
      typeof raw.lowStockProducts === "object") ||
    (raw.noStockProducts != null && typeof raw.noStockProducts === "object") ||
    Array.isArray(raw.mostSoldProducts) ||
    "mostProfitableProduct" in raw
  );
}

export function unwrapDashboardStatsPayload(
  raw: unknown
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (
    "todaySales" in obj ||
    "totalSales" in obj ||
    "outstandingCredits" in obj ||
    "currency" in obj
  ) {
    return obj;
  }
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

function paginateLocal<T>(
  items: T[],
  page: number,
  limit: number
): PaginatedResponse<T> {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 0),
    },
  };
}

function productImageFromCache(
  cached: Record<string, unknown>
): string | undefined {
  const image =
    (cached.productImage as string | null | undefined) ??
    (cached.imageUrl as string | null | undefined);
  return image ? String(image) : undefined;
}

function trimmedName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function performanceRowId(row: DashboardProductPerformance): string {
  return String(row.productId || (row as { id?: string }).id || "");
}

type ProductNameSources = {
  fromProduct?: { name: string; imageUrl?: string };
  fromSaleLine?: { name: string; imageUrl?: string };
};

/**
 * Name sources for dashboard product rows:
 * 1. current product name from `products`
 * 2. else `productName` stored on the sale line item
 */
export async function resolveProductDetails(
  productIds: string[]
): Promise<Map<string, ProductNameSources>> {
  const unique = [...new Set(productIds.filter(Boolean).map(String))];
  const result = new Map<string, ProductNameSources>();
  if (unique.length === 0) return result;

  for (const id of unique) {
    result.set(id, {});
  }

  try {
    const db = getDb();
    const cachedRows = await db.productCache.toArray();
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of cachedRows) {
      if (row?.id == null) continue;
      byId.set(String(row.id), row as unknown as Record<string, unknown>);
    }

    for (const id of unique) {
      const cached = byId.get(id) ?? (await db.productCache.get(id));
      if (!cached) continue;
      const row = cached as unknown as Record<string, unknown>;
      const name = trimmedName(row.name);
      if (!name) continue;
      result.set(id, {
        ...result.get(id),
        fromProduct: {
          name,
          imageUrl: productImageFromCache(row),
        },
      });
    }
  } catch {
    // Product cache is optional.
  }

  const missingSaleLine = unique.filter((id) => !result.get(id)?.fromProduct);
  if (missingSaleLine.length === 0) return result;

  try {
    const db = getDb();
    const txRows = await db.transactionCache.toArray();

    for (const tx of txRows) {
      const items = Array.isArray((tx as { items?: unknown[] }).items)
        ? ((tx as { items?: unknown[] }).items as Array<
            Record<string, unknown>
          >)
        : [];

      for (const item of items) {
        const productId =
          item.productId != null ? String(item.productId) : null;
        if (!productId) continue;
        const sources = result.get(productId);
        if (!sources || sources.fromSaleLine) continue;

        const productName = trimmedName(item.productName);
        if (!productName) continue;

        sources.fromSaleLine = {
          name: productName,
          imageUrl:
            typeof item.imageUrl === "string" && item.imageUrl.trim()
              ? item.imageUrl.trim()
              : undefined,
        };
      }
    }
  } catch {
    // Sale-line cache is optional.
  }

  return result;
}

function normalizeDashboardStatsResponse(
  raw: Partial<DashboardStatsResponse> & Record<string, unknown>,
  page = 1,
  limit = 5
): DashboardStatsResponse {
  return {
    currency: (raw.currency as StoreCurrency) ?? "USD",
    totalSales: Number(raw.totalSales ?? 0),
    todaySales: Number(raw.todaySales ?? 0),
    totalCustomers: Number(raw.totalCustomers ?? 0),
    outstandingCredits: Number(raw.outstandingCredits ?? 0),
    approachingDueDates: Array.isArray(raw.approachingDueDates)
      ? raw.approachingDueDates
      : [],
    creditsToRecover:
      raw.creditsToRecover && Array.isArray(raw.creditsToRecover.data)
        ? raw.creditsToRecover
        : emptyPage(page, limit),
    overdueCredits:
      raw.overdueCredits && Array.isArray(raw.overdueCredits.data)
        ? raw.overdueCredits
        : emptyPage(page, limit),
    lowStockProducts:
      raw.lowStockProducts && Array.isArray(raw.lowStockProducts.data)
        ? raw.lowStockProducts
        : emptyPage(page, limit),
    noStockProducts:
      raw.noStockProducts && Array.isArray(raw.noStockProducts.data)
        ? raw.noStockProducts
        : emptyPage(page, limit),
    mostSoldProducts: Array.isArray(raw.mostSoldProducts)
      ? raw.mostSoldProducts
      : [],
    mostProfitableProduct: raw.mostProfitableProduct ?? null,
  };
}

export async function enrichDashboardStats(
  statsInput: DashboardStatsResponse | Record<string, unknown>,
  options?: { page?: number; limit?: number }
): Promise<Omit<DashboardStatsView, "source">> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 5;
  const stats = normalizeDashboardStatsResponse(
    statsInput as Partial<DashboardStatsResponse> & Record<string, unknown>,
    page,
    limit
  );

  const productIds = [
    ...stats.mostSoldProducts.map((p) => performanceRowId(p)),
    ...(stats.mostProfitableProduct
      ? [performanceRowId(stats.mostProfitableProduct)]
      : []),
    ...stats.lowStockProducts.data.map((p) => p.id),
    ...stats.noStockProducts.data.map((p) => p.id),
  ];
  const details = await resolveProductDetails(productIds);

  const enrichPerf = (
    row: DashboardProductPerformance
  ): EnrichedProductPerformance => {
    const id = performanceRowId(row);
    const sources = details.get(id);
    const fromProducts = sources?.fromProduct?.name ?? trimmedName(row.name);
    const fromSaleLine =
      sources?.fromSaleLine?.name ?? trimmedName(row.productName);
    return {
      ...row,
      productId: id || row.productId,
      name: fromProducts ?? fromSaleLine ?? "Unknown product",
      imageUrl:
        sources?.fromProduct?.imageUrl ?? sources?.fromSaleLine?.imageUrl,
    };
  };

  const enrichStock = (
    row: {
      id: string;
      name: string;
      stock: number;
    } & Partial<DashboardLowStockProduct>
  ): EnrichedStockRow => ({
    id: row.id,
    name: row.name,
    stock: row.stock,
    lowStockThreshold:
      row.lowStockThreshold != null ? Number(row.lowStockThreshold) : undefined,
    imageUrl: details.get(row.id)?.fromProduct?.imageUrl,
  });

  return {
    currency: stats.currency ?? "USD",
    todaySales: Number(stats.todaySales ?? 0),
    totalSales: Number(stats.totalSales ?? 0),
    totalCustomers: Number(stats.totalCustomers ?? 0),
    outstandingCredits: Number(stats.outstandingCredits ?? 0),
    approachingDueDates: stats.approachingDueDates ?? [],
    creditsToRecover: stats.creditsToRecover ?? emptyPage(page, limit),
    overdueCredits: stats.overdueCredits ?? emptyPage(page, limit),
    lowStockProducts: {
      data: (stats.lowStockProducts?.data ?? []).map(enrichStock),
      meta: stats.lowStockProducts?.meta ?? emptyMeta(page, limit),
    },
    noStockProducts: {
      data: (stats.noStockProducts?.data ?? []).map(enrichStock),
      meta: stats.noStockProducts?.meta ?? emptyMeta(page, limit),
    },
    mostSoldProducts: (stats.mostSoldProducts ?? []).map(enrichPerf),
    mostProfitableProduct: stats.mostProfitableProduct
      ? enrichPerf(stats.mostProfitableProduct)
      : null,
  };
}

function creditRowsFromTransactions(
  transactions: Transaction[],
  customersById: Map<string, { name: string }>,
  mode: "upcoming" | "overdue",
  referenceDate: Date = new Date()
): DashboardCreditRow[] {
  const now = startOfDay(referenceDate).getTime();
  const rows: DashboardCreditRow[] = [];

  for (const tx of transactions) {
    if (tx.paymentMethod !== "Credit") continue;
    const status = String(tx.status ?? "").toLowerCase();
    if (status === "paid" || tx.creditSettledAt) continue;
    const dueRaw = tx.creditDetails?.paymentDate;
    if (!dueRaw) continue;
    let due: Date;
    try {
      due = parseISO(dueRaw);
    } catch {
      continue;
    }
    const dueTs = startOfDay(due).getTime();
    if (mode === "upcoming" && dueTs < now) continue;
    if (mode === "overdue" && dueTs >= now) continue;

    const cid = tx.customerId ?? tx.tempCustomerId;
    const clientName =
      (cid && customersById.get(String(cid))?.name) || "Customer";

    rows.push({
      id: String(tx.id ?? tx.idempotencyKey ?? ""),
      clientName,
      totalAmount: Number(tx.total ?? 0),
      dueDate: dueRaw,
    });
  }

  return rows
    .filter((r) => r.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function buildApproachingDueDates(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): DashboardApproachingDueDate[] {
  const buckets = new Map<
    string,
    {
      dueDate: string;
      credits: Array<{ id: string; customerId: string }>;
      customerIds: Set<string>;
      totalAmount: number;
    }
  >();
  const today = startOfDay(referenceDate);

  for (const tx of transactions) {
    if (tx.paymentMethod !== "Credit") continue;
    const status = String(tx.status ?? "").toLowerCase();
    if (status === "paid" || tx.creditSettledAt) continue;
    const dueRaw = tx.creditDetails?.paymentDate;
    if (!dueRaw) continue;
    let due: Date;
    try {
      due = parseISO(dueRaw);
    } catch {
      continue;
    }
    if (startOfDay(due).getTime() < today.getTime()) continue;
    const key = dueRaw.slice(0, 10);
    const cid = String(tx.customerId ?? tx.tempCustomerId ?? "");
    const id = String(tx.id ?? "");
    if (!id) continue;
    const existing = buckets.get(key);
    if (existing) {
      existing.credits.push({ id, customerId: cid });
      if (cid) existing.customerIds.add(cid);
      existing.totalAmount += Number(tx.total ?? 0);
    } else {
      buckets.set(key, {
        dueDate: dueRaw,
        credits: [{ id, customerId: cid }],
        customerIds: new Set(cid ? [cid] : []),
        totalAmount: Number(tx.total ?? 0),
      });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 2)
    .map((b) => ({
      dueDate: b.dueDate,
      credits: b.credits,
      clientsOwingCount: b.customerIds.size || b.credits.length,
      totalAmount: b.totalAmount,
    }));
}

export async function loadDexieDashboardStatsView(
  storeId: string | null | undefined,
  page: number,
  limit: number,
  currency: StoreCurrency = "USD"
): Promise<DashboardStatsView> {
  const [customersResult, transactionsResult, productsResult] =
    await Promise.all([
      getCustomersFromDexie(1, 10000, undefined, storeId),
      getTransactionsFromDexie(1, 10000, storeId),
      getProductsFromDexie(1, 10000, storeId),
    ]);

  const customers = customersResult.data;
  const transactions = transactionsResult.data;
  const products = productsResult.data;
  const customersById = new Map(
    customers.map((c) => [String(c.id), { name: c.name }] as const)
  );

  const summaryMetrics = buildDashboardMetrics(customers, transactions);
  const productsForInsights = products.map((p) => ({
    id: p.id,
    name: p.name,
    stock: Number(p.stock ?? 0),
    lowStockThreshold: p.lowStockThreshold ?? undefined,
    imageUrl: p.productImage ?? undefined,
    productImage: p.productImage ?? undefined,
  }));
  const { lowStock, outOfStock } = getStockAlerts(productsForInsights);
  const topByRevenue = getTopProducts(transactions, productsForInsights, 5);
  const topByUnits = [...topByRevenue].sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue
  );

  const upcoming = creditRowsFromTransactions(
    transactions,
    customersById,
    "upcoming"
  );
  const overdue = creditRowsFromTransactions(
    transactions,
    customersById,
    "overdue"
  );

  return {
    currency,
    todaySales: summaryMetrics.todaySales,
    totalSales: transactions.reduce((sum, t) => sum + Number(t.total ?? 0), 0),
    totalCustomers: summaryMetrics.totalCustomers,
    outstandingCredits: summaryMetrics.outstandingCredit,
    approachingDueDates: buildApproachingDueDates(transactions),
    creditsToRecover: paginateLocal(upcoming, page, limit),
    overdueCredits: paginateLocal(overdue, page, limit),
    lowStockProducts: paginateLocal(
      lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        imageUrl: p.imageUrl,
      })),
      page,
      limit
    ),
    noStockProducts: paginateLocal(
      outOfStock.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        imageUrl: p.imageUrl,
      })),
      page,
      limit
    ),
    mostSoldProducts: topByUnits.map((p) => ({
      productId: p.productId,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      name: p.name,
      imageUrl: p.imageUrl,
    })),
    mostProfitableProduct: topByRevenue[0]
      ? {
          productId: topByRevenue[0].productId,
          unitsSold: topByRevenue[0].unitsSold,
          revenue: topByRevenue[0].revenue,
          name: topByRevenue[0].name,
          imageUrl: topByRevenue[0].imageUrl,
        }
      : null,
    source: "dexie",
  };
}

export async function loadApiDashboardStatsView(
  page: number,
  limit: number,
  options?: {
    storeId?: string | null;
    fallbackCurrency?: StoreCurrency;
  }
): Promise<DashboardStatsView> {
  const response = await dashboardStatsApi.get({ page, limit });
  const raw = unwrapDashboardStatsPayload(response.data);
  const enriched = await enrichDashboardStats(raw, { page, limit });

  // New contract: use API panels as-is (names resolved from products, then sale line).
  if (isNewDashboardStatsContract(raw)) {
    return { ...enriched, source: "api" };
  }

  // Legacy contract: keep API KPI + currency, fill panels from local cache.
  if (options?.storeId) {
    const local = await loadDexieDashboardStatsView(
      options.storeId,
      page,
      limit,
      enriched.currency || options.fallbackCurrency || "USD"
    );
    const kpis = mapDashboardKpis(enriched);
    return {
      ...local,
      ...kpis,
      source: "api",
    };
  }

  return { ...enriched, source: "api" };
}
