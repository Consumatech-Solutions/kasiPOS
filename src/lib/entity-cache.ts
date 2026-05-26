import {
  getDb,
  type ProductCacheRecord,
  type CategoryCacheRecord,
} from "@/lib/db";
import type { PaginationMeta } from "@/types/pagination";
import type { ApiProduct, ApiCategory } from "@/types/catalogue";
import type { Customer, PurchaseOrder } from "@/types";
import type { Transaction, Voucher, StockAdjustment, Parcel } from "@/types";

const ENTITY_CAP = 10000;

function entityCap(): number {
  if (
    typeof process !== "undefined" &&
    process.env.KASIPOS_TEST_ENTITY_CAP !== undefined
  ) {
    const n = Number(process.env.KASIPOS_TEST_ENTITY_CAP);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return ENTITY_CAP;
}

const PURCHASE_ORDERS_KEY = "purchaseOrders";
const PURCHASE_ORDER_CAP = 1000;

export const LAST_SYNC_KEYS = {
  products: "products-lastSync",
  categories: "categories-lastSync",
  customers: "customers-lastSync",
} as const;

export type LastSyncEntity = keyof typeof LAST_SYNC_KEYS;

export async function getLastSyncAt(
  entity: LastSyncEntity
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const db = getDb();
  const record = await db.keyVal.get(LAST_SYNC_KEYS[entity]);
  return record?.value ?? null;
}

export async function setLastSyncAt(
  entity: LastSyncEntity,
  isoDate: string
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  await db.keyVal.put({ key: LAST_SYNC_KEYS[entity], value: isoDate });
}

function resolvedProductStoreId(
  p: ApiProduct & {
    storeId?: string | number | null;
    store_id?: string | number | null;
  },
  fallback?: string | null
): string | undefined {
  const fromRow = p.storeId ?? p.store_id;
  if (fromRow != null && fromRow !== "") return String(fromRow);
  if (fallback != null && fallback !== "") return String(fallback);
  return undefined;
}

export async function saveProductsToDexie(
  data: ApiProduct[],
  storeId?: string | null
): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  const records = data.map((p) => {
    const sid = resolvedProductStoreId(
      p as ApiProduct & { storeId?: string | number | null },
      storeId
    );
    return {
      ...p,
      id: p.id,
      createdAt: p.createdAt ?? new Date().toISOString(),
      ...(sid != null ? { storeId: sid } : {}),
    };
  });
  await db.productCache.bulkPut(records);
  const count = await db.productCache.count();
  const cap = entityCap();
  if (count > cap) {
    const toRemove = count - cap;
    const oldest = await db.productCache
      .orderBy("createdAt")
      .limit(toRemove)
      .toArray();
    await db.productCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function saveCustomersToDexie(data: Customer[]): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  await db.customers.bulkPut(data);
  const count = await db.customers.count();
  const cap = entityCap();
  if (count > cap) {
    const allCust = await db.customers.toArray();
    allCust.sort((a, b) =>
      ((a as Customer).updatedAt ?? "").localeCompare(
        (b as Customer).updatedAt ?? ""
      )
    );
    const toDelete = allCust.slice(0, count - cap).map((r) => r.id);
    await db.customers.bulkDelete(toDelete);
  }
}

export async function saveTransactionsToDexie(
  data: Transaction[]
): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  const records = data.map((t) => ({
    ...t,
    id: t.id ?? `local-${Date.now()}-${Math.random()}`,
    date:
      (t as Transaction & { date?: string }).date ?? new Date().toISOString(),
  }));
  await db.transactionCache.bulkPut(
    records as { id: string; date?: string; [k: string]: unknown }[]
  );
  const count = await db.transactionCache.count();
  const cap = entityCap();
  if (count > cap) {
    const toRemove = count - cap;
    const oldest = await db.transactionCache
      .orderBy("date")
      .limit(toRemove)
      .toArray();
    await db.transactionCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function updateProductStockInDexie(
  productId: string,
  newStock: number
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  const product = await db.productCache.get(productId);
  if (product) {
    await db.productCache.put({ ...product, stock: newStock });
  }
}

export async function updateProductInDexie(
  productId: string,
  updates: Partial<ApiProduct>
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  const product = await db.productCache.get(productId);
  if (product) {
    await db.productCache.put({ ...product, ...updates, id: productId });
  }
}

export async function deleteProductFromDexie(productId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  await db.productCache.delete(productId);
}

export async function saveCategoriesToDexie(
  data: ApiCategory[],
  storeId?: string | null
): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  const records = data.map((c) => ({
    id: c.id,
    name: c.name,
    ...(storeId != null && storeId !== "" && { storeId: String(storeId) }),
    createdAt: c.createdAt ?? new Date().toISOString(),
    updatedAt: c.updatedAt ?? new Date().toISOString(),
  }));
  await db.categoryCache.bulkPut(records);
  const count = await db.categoryCache.count();
  const cap = entityCap();
  if (count > cap) {
    const toRemove = count - cap;
    const oldest = await db.categoryCache
      .orderBy("createdAt")
      .limit(toRemove)
      .toArray();
    await db.categoryCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function getCategoriesFromDexie(
  page: number,
  limit: number,
  storeIdForOffline?: string | null
): Promise<{ data: ApiCategory[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const all = await db.categoryCache.orderBy("createdAt").reverse().toArray();
  const scoped =
    storeIdForOffline != null && storeIdForOffline !== ""
      ? all.filter((c) => {
          const sid = c.storeId;
          if (sid == null || sid === "") return false;
          return String(sid) === String(storeIdForOffline);
        })
      : all;
  const total = scoped.length;
  const data = scoped.slice((page - 1) * limit, (page - 1) * limit + limit);
  return {
    data: data as unknown as ApiCategory[],
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function updateCategoryInDexie(
  categoryId: string,
  updates: Partial<ApiCategory>
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  const category = await db.categoryCache.get(categoryId);
  if (category) {
    await db.categoryCache.put({ ...category, ...updates, id: categoryId });
  }
}

export async function deleteCategoryFromDexie(
  categoryId: string
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  await db.categoryCache.delete(categoryId);
}

const TEMP_ENTITY_ID_PREFIX = "temp-";

export function isTempEntityId(id: unknown): boolean {
  return id != null && String(id).startsWith(TEMP_ENTITY_ID_PREFIX);
}

function rowMatchesStoreScope(
  rowStoreId: string | number | null | undefined,
  syncStoreId: string | null | undefined
): boolean {
  if (syncStoreId == null || syncStoreId === "") return true;
  if (rowStoreId == null || rowStoreId === "") return true;
  return String(rowStoreId) === String(syncStoreId);
}

export type PurgeTempIdCatalogueResult = {
  productsRemoved: number;
  categoriesRemoved: number;
  customersRemoved: number;
};

export async function purgeTempIdCatalogueRowsAfterCloudSync(
  storeId?: string | null
): Promise<PurgeTempIdCatalogueResult> {
  if (typeof window === "undefined") {
    return { productsRemoved: 0, categoriesRemoved: 0, customersRemoved: 0 };
  }
  const db = getDb();

  const products = await db.productCache.toArray();
  const productIds = products
    .filter((p) => isTempEntityId(p.id))
    .filter((p) =>
      rowMatchesStoreScope(
        (p as { storeId?: string | number | null }).storeId,
        storeId
      )
    )
    .map((p) => String(p.id));

  const categories = await db.categoryCache.toArray();
  const categoryIds = categories
    .filter((c) => isTempEntityId(c.id))
    .filter((c) => rowMatchesStoreScope(c.storeId, storeId))
    .map((c) => String(c.id));

  const customerRows = await db.customers.toArray();
  const customerIds = customerRows
    .filter((c) => isTempEntityId((c as Customer).id))
    .filter((c) => rowMatchesStoreScope((c as Customer).storeId, storeId))
    .map((c) => String((c as Customer).id));

  if (productIds.length > 0) await db.productCache.bulkDelete(productIds);
  if (categoryIds.length > 0) await db.categoryCache.bulkDelete(categoryIds);
  if (customerIds.length > 0) await db.customers.bulkDelete(customerIds);

  return {
    productsRemoved: productIds.length,
    categoriesRemoved: categoryIds.length,
    customersRemoved: customerIds.length,
  };
}

const PURGE_UNSCOPED_PRODUCTS_KEY_PREFIX =
  "kasipos-purged-unscoped-products-v2";
const PURGE_UNSCOPED_CATEGORIES_KEY_PREFIX =
  "kasipos-purged-unscoped-categories-v2";

export type PurgeUnscopedProductsResult = { removed: number };
export type PurgeUnscopedCategoriesResult = { removed: number };

export async function purgeUnscopedProductsCacheOnce(
  storeId: string
): Promise<PurgeUnscopedProductsResult | null> {
  if (typeof window === "undefined" || !storeId) return null;
  const key = `${PURGE_UNSCOPED_PRODUCTS_KEY_PREFIX}:${storeId}`;
  try {
    if (localStorage.getItem(key) === "1") {
      return null;
    }
    const db = getDb();
    const products = await db.productCache.toArray();
    const productIds = products
      .filter((p: ProductCacheRecord) => {
        const sid = p.storeId;
        return sid == null || sid === "";
      })
      .map((p) => p.id);

    if (productIds.length > 0) {
      await db.productCache.bulkDelete(productIds);
    }
    localStorage.setItem(key, "1");
    return { removed: productIds.length };
  } catch (e) {
    console.error("[entity-cache] purgeUnscopedProductsCacheOnce failed:", e);
    return null;
  }
}

export async function purgeUnscopedCategoriesCacheOnce(
  storeId: string
): Promise<PurgeUnscopedCategoriesResult | null> {
  if (typeof window === "undefined" || !storeId) return null;
  const key = `${PURGE_UNSCOPED_CATEGORIES_KEY_PREFIX}:${storeId}`;
  try {
    if (localStorage.getItem(key) === "1") {
      return null;
    }
    const db = getDb();
    const categories = await db.categoryCache.toArray();
    const categoryIds = categories
      .filter((c: CategoryCacheRecord) => {
        const sid = c.storeId;
        return sid == null || sid === "";
      })
      .map((c) => c.id);

    if (categoryIds.length > 0) {
      await db.categoryCache.bulkDelete(categoryIds);
    }
    localStorage.setItem(key, "1");
    return { removed: categoryIds.length };
  } catch (e) {
    console.error("[entity-cache] purgeUnscopedCategoriesCacheOnce failed:", e);
    return null;
  }
}

export async function purgeUnscopedCatalogueCacheOnce(
  storeId: string
): Promise<{ productsRemoved: number; categoriesRemoved: number } | null> {
  const p = await purgeUnscopedProductsCacheOnce(storeId);
  const c = await purgeUnscopedCategoriesCacheOnce(storeId);
  if (p === null && c === null) return null;
  return {
    productsRemoved: p?.removed ?? 0,
    categoriesRemoved: c?.removed ?? 0,
  };
}

export async function updateCustomerInDexie(
  customerId: string,
  updates: Partial<Customer>
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  const customer = await db.customers.get(customerId);
  if (customer) {
    await db.customers.put({ ...customer, ...updates, id: customerId });
  }
}

export async function deleteCustomerFromDexie(
  customerId: string
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  await db.customers.delete(customerId);
}

export async function savePurchaseOrdersToDexie(
  orders: PurchaseOrder[]
): Promise<void> {
  if (typeof window === "undefined" || !orders.length) return;
  const db = getDb();
  const record = await db.keyVal.get(PURCHASE_ORDERS_KEY);
  const existing: PurchaseOrder[] = record?.value
    ? JSON.parse(record.value)
    : [];
  const byId = new Map<string, PurchaseOrder>(
    existing.map((o) => [o.id ?? "", o])
  );
  for (const o of orders) {
    if (o.id) byId.set(o.id, o);
  }
  const merged = Array.from(byId.values()).sort((a, b) => {
    const aT = a.createdAt ?? "";
    const bT = b.createdAt ?? "";
    return bT.localeCompare(aT);
  });
  const capped = merged.slice(0, PURCHASE_ORDER_CAP);
  await db.keyVal.put({
    key: PURCHASE_ORDERS_KEY,
    value: JSON.stringify(capped),
  });
}

export async function getPurchaseOrdersFromDexie(
  page: number = 1,
  limit: number = 10
): Promise<{ data: PurchaseOrder[]; total: number }> {
  if (typeof window === "undefined") {
    return { data: [], total: 0 };
  }
  const db = getDb();
  const record = await db.keyVal.get(PURCHASE_ORDERS_KEY);
  const all: PurchaseOrder[] = record?.value ? JSON.parse(record.value) : [];
  const total = all.length;
  const start = (page - 1) * limit;
  const data = all.slice(start, start + limit);
  return { data, total };
}

export async function updatePurchaseOrderStatusInDexie(
  orderId: string,
  newStatus: "pending" | "completed" | "cancelled"
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDb();
  const record = await db.keyVal.get(PURCHASE_ORDERS_KEY);
  const all: PurchaseOrder[] = record?.value ? JSON.parse(record.value) : [];
  const updated = all.map((o) =>
    o.id === orderId ? { ...o, status: newStatus } : o
  );
  await db.keyVal.put({
    key: PURCHASE_ORDERS_KEY,
    value: JSON.stringify(updated),
  });
}

export type ProductDexieListFilters = {
  search?: string;
  categoryId?: string;
};

function filterProductsInMemory(
  rows: ApiProduct[],
  filters?: ProductDexieListFilters
): ApiProduct[] {
  if (!filters?.search?.trim() && !filters?.categoryId) {
    return rows;
  }
  let out = rows;
  if (filters.categoryId) {
    const cid = String(filters.categoryId);
    out = out.filter((p) => String(p.categoryId) === cid);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    out = out.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const code = (p.barCode ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }
  return out;
}

export async function getProductsFromDexie(
  page: number,
  limit: number,
  storeIdForOffline?: string | null,
  filters?: ProductDexieListFilters
): Promise<{ data: ApiProduct[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const categories = await db.categoryCache.toArray();

  let pool: ApiProduct[];

  if (storeIdForOffline != null && storeIdForOffline !== "") {
    const all = await db.productCache.orderBy("createdAt").reverse().toArray();
    const storeIdStr = String(storeIdForOffline);
    const filtered = all.filter((p: ProductCacheRecord) => {
      const sid = p.storeId;
      if (sid == null || sid === "") return false;
      return String(sid) === storeIdStr;
    });
    pool = filtered as unknown as ApiProduct[];
  } else {
    pool = (await db.productCache
      .orderBy("createdAt")
      .reverse()
      .toArray()) as unknown as ApiProduct[];
  }

  const withCategories = pool.map((product): ApiProduct => {
    const cat = product.category;
    const hasCategory =
      cat != null &&
      (typeof cat === "object"
        ? !!(cat as { name?: string }).name?.trim()
        : String(cat).trim() !== "");
    if (product.categoryId && !hasCategory) {
      const category = categories.find(
        (c) => String(c.id) === String(product.categoryId)
      );
      if (category) {
        const ac = category as ApiCategory;
        return {
          ...(product as ApiProduct),
          category: { id: ac.id, name: ac.name },
        };
      }
    }
    return product as ApiProduct;
  });

  const filtered = filterProductsInMemory(withCategories, filters);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getCustomersFromDexie(
  page: number,
  limit: number,
  search?: string,
  storeId?: string | null
): Promise<{ data: Customer[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.customers.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter((c) => (c as Customer).storeId === storeId);
  }
  all.sort((a, b) => {
    const aT = (a as Customer).updatedAt ?? "";
    const bT = (b as Customer).updatedAt ?? "";
    return bT.localeCompare(aT);
  });
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    all = all.filter(
      (c) =>
        (c.name && String(c.name).toLowerCase().includes(q)) ||
        (c.contact && String(c.contact).toLowerCase().includes(q))
    );
  }
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit) as Customer[];
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getTransactionsFromDexie(
  page: number,
  limit: number,
  storeId?: string | null
): Promise<{ data: Transaction[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.transactionCache.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter(
      (t) =>
        (t as unknown as Transaction & { storeId?: string }).storeId === storeId
    );
  }
  const sorted = (all as { date?: string }[]).sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );
  const total = sorted.length;
  const data = sorted.slice(
    (page - 1) * limit,
    page * limit
  ) as unknown as Transaction[];
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getCustomerTransactionsFromDexie(args: {
  customerId: string;
  storeId?: string | null;
  limit?: number;
}): Promise<Transaction[]> {
  if (typeof window === "undefined") return [];
  const { customerId, storeId, limit } = args;
  if (!customerId) return [];
  const db = getDb();
  let all = await db.transactionCache.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter(
      (t) =>
        (t as unknown as Transaction & { storeId?: string | number | null })
          .storeId != null &&
        String(
          (t as unknown as Transaction & { storeId?: string | number | null })
            .storeId
        ) === String(storeId)
    );
  }
  const cid = String(customerId);
  const filtered = (all as unknown as Transaction[]).filter((t) => {
    const tCid = (t as unknown as { customerId?: unknown }).customerId;
    if (tCid == null) return false;
    return String(tCid) === cid;
  });
  const sorted = filtered.sort((a, b) => {
    const aT = (a.createdAt ?? String(a.date ?? "")) as string;
    const bT = (b.createdAt ?? String(b.date ?? "")) as string;
    return String(bT).localeCompare(String(aT));
  });
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return sorted.slice(0, Math.trunc(limit));
  }
  return sorted;
}

export async function getCustomerTransactionsFromTransactionsTable(args: {
  customerId: string;
  storeId?: string | null;
  limit?: number;
}): Promise<Transaction[]> {
  if (typeof window === "undefined") return [];
  const { customerId, storeId, limit } = args;
  if (!customerId) return [];
  const db = getDb();
  let all = await db.transactions.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter(
      (t) => t.storeId != null && String(t.storeId) === String(storeId)
    );
  }
  const cid = String(customerId);
  const filtered = all.filter((t) => {
    const tCid = t.customerId;
    const tTempCid = (t as Transaction & { tempCustomerId?: string | null })
      .tempCustomerId;
    if (tCid == null && tTempCid == null) return false;
    return String(tCid ?? "") === cid || String(tTempCid ?? "") === cid;
  });
  const sorted = filtered.sort((a, b) => {
    const aT = (a.createdAt ?? String(a.date ?? "")) as string;
    const bT = (b.createdAt ?? String(b.date ?? "")) as string;
    return String(bT).localeCompare(String(aT));
  });
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return sorted.slice(0, Math.trunc(limit));
  }
  return sorted;
}

export async function saveVouchersToDexie(data: Voucher[]): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  await db.vouchers.bulkPut(data);
}

export async function getVouchersFromDexie(
  page: number,
  limit: number,
  storeId?: string | null
): Promise<{ data: Voucher[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.vouchers.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter((v) => v.storeId === storeId);
  }
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function saveStockAdjustmentsToDexie(
  data: StockAdjustment[]
): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  await db.stockAdjustments.bulkPut(data);
}

export async function getStockAdjustmentsFromDexie(
  page: number,
  limit: number,
  storeId?: string | null,
  productId?: string | null
): Promise<{ data: StockAdjustment[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.stockAdjustments.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter((a) => a.storeId === storeId);
  }
  if (productId != null && productId !== "") {
    all = all.filter((a) => String(a.productId) === String(productId));
  }
  const sorted = all.sort((a, b) => {
    // `date` is optional for backward compatibility, so fall back to `createdAt`.
    const aTime = a.date?.getTime() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const bTime = b.date?.getTime() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return bTime - aTime;
  });
  const total = sorted.length;
  const data = sorted.slice((page - 1) * limit, page * limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function saveParcelsToDexie(data: Parcel[]): Promise<void> {
  if (typeof window === "undefined" || !data.length) return;
  const db = getDb();
  await db.parcels.bulkPut(data);
}

export async function getParcelsFromDexie(
  page: number,
  limit: number,
  storeId?: string | null
): Promise<{ data: Parcel[]; meta: PaginationMeta }> {
  if (typeof window === "undefined") {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.parcels.toArray();
  if (storeId != null && storeId !== "") {
    all = all.filter((p) => p.storeId === storeId);
  }
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
