/**
 * Entity cache: persist API data to Dexie with cap, read when offline.
 */

import { getDb } from '@/lib/db';
import type { PaginationMeta } from '@/types/pagination';
import type { ApiProduct, ApiCategory } from '@/types/catalogue';
import type { Customer, PurchaseOrder } from '@/types';
import type { Transaction } from '@/types';

const ENTITY_CAP = 10000;
const PURCHASE_ORDERS_KEY = 'purchaseOrders';
const PURCHASE_ORDER_CAP = 1000;

export const LAST_SYNC_KEYS = {
  products: 'products-lastSync',
  categories: 'categories-lastSync',
  customers: 'customers-lastSync',
} as const;

export type LastSyncEntity = keyof typeof LAST_SYNC_KEYS;

export async function getLastSyncAt(entity: LastSyncEntity): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const db = getDb();
  const record = await db.keyVal.get(LAST_SYNC_KEYS[entity]);
  return record?.value ?? null;
}

export async function setLastSyncAt(entity: LastSyncEntity, isoDate: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.keyVal.put({ key: LAST_SYNC_KEYS[entity], value: isoDate });
}

export async function saveProductsToDexie(
  data: ApiProduct[],
  storeId?: string | null
): Promise<void> {
  if (typeof window === 'undefined' || !data.length) return;
  const db = getDb();
  const records = data.map((p) => ({
    ...p,
    id: p.id,
    createdAt: p.createdAt ?? new Date().toISOString(),
    ...(storeId != null && storeId !== '' && { storeId }),
  }));
  await db.productCache.bulkPut(records);
  const count = await db.productCache.count();
  if (count > ENTITY_CAP) {
    const toRemove = count - ENTITY_CAP;
    const oldest = await db.productCache.orderBy('createdAt').limit(toRemove).toArray();
    await db.productCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function saveCustomersToDexie(data: Customer[]): Promise<void> {
  if (typeof window === 'undefined' || !data.length) return;
  const db = getDb();
  await db.customers.bulkPut(data);
  const count = await db.customers.count();
  if (count > ENTITY_CAP) {
    const allCust = await db.customers.toArray();
    allCust.sort((a, b) => ((a as Customer).updatedAt ?? '').localeCompare((b as Customer).updatedAt ?? ''));
    const toDelete = allCust.slice(0, count - ENTITY_CAP).map((r) => r.id);
    await db.customers.bulkDelete(toDelete);
  }
}

export async function saveTransactionsToDexie(data: Transaction[]): Promise<void> {
  if (typeof window === 'undefined' || !data.length) return;
  const db = getDb();
  const records = data.map((t) => ({
    ...t,
    id: t.id ?? `local-${Date.now()}-${Math.random()}`,
    date: (t as Transaction & { date?: string }).date ?? new Date().toISOString(),
  }));
  await db.transactionCache.bulkPut(records as { id: string; date?: string; [k: string]: unknown }[]);
  const count = await db.transactionCache.count();
  if (count > ENTITY_CAP) {
    const toRemove = count - ENTITY_CAP;
    const oldest = await db.transactionCache.orderBy('date').limit(toRemove).toArray();
    await db.transactionCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function updateProductStockInDexie(productId: string, newStock: number): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const product = await db.productCache.get(productId);
  if (product) {
    await db.productCache.put({ ...product, stock: newStock });
  }
}

export async function updateProductInDexie(productId: string, updates: Partial<ApiProduct>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const product = await db.productCache.get(productId);
  if (product) {
    await db.productCache.put({ ...product, ...updates, id: productId });
  }
}

export async function deleteProductFromDexie(productId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.productCache.delete(productId);
}

export async function saveCategoriesToDexie(data: ApiCategory[]): Promise<void> {
  if (typeof window === 'undefined' || !data.length) return;
  const db = getDb();
  const records = data.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt ?? new Date().toISOString(),
    updatedAt: c.updatedAt ?? new Date().toISOString(),
  }));
  await db.categoryCache.bulkPut(records);
  const count = await db.categoryCache.count();
  if (count > ENTITY_CAP) {
    const toRemove = count - ENTITY_CAP;
    const oldest = await db.categoryCache.orderBy('createdAt').limit(toRemove).toArray();
    await db.categoryCache.bulkDelete(oldest.map((r) => r.id));
  }
}

export async function getCategoriesFromDexie(
  page: number,
  limit: number
): Promise<{ data: ApiCategory[]; meta: PaginationMeta }> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const total = await db.categoryCache.count();
  const data = await db.categoryCache
    .orderBy('createdAt')
    .reverse()
    .offset((page - 1) * limit)
    .limit(limit)
    .toArray();
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

export async function updateCategoryInDexie(categoryId: string, updates: Partial<ApiCategory>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const category = await db.categoryCache.get(categoryId);
  if (category) {
    await db.categoryCache.put({ ...category, ...updates, id: categoryId });
  }
}

export async function deleteCategoryFromDexie(categoryId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.categoryCache.delete(categoryId);
}

export async function updateCustomerInDexie(customerId: string, updates: Partial<Customer>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const customer = await db.customers.get(customerId);
  if (customer) {
    await db.customers.put({ ...customer, ...updates, id: customerId });
  }
}

export async function deleteCustomerFromDexie(customerId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.customers.delete(customerId);
}

export async function savePurchaseOrdersToDexie(orders: PurchaseOrder[]): Promise<void> {
  if (typeof window === 'undefined' || !orders.length) return;
  const db = getDb();
  const record = await db.keyVal.get(PURCHASE_ORDERS_KEY);
  const existing: PurchaseOrder[] = record?.value ? JSON.parse(record.value) : [];
  const byId = new Map<string, PurchaseOrder>(existing.map((o) => [o.id ?? '', o]));
  for (const o of orders) {
    if (o.id) byId.set(o.id, o);
  }
  const merged = Array.from(byId.values()).sort((a, b) => {
    const aT = a.createdAt ?? '';
    const bT = b.createdAt ?? '';
    return bT.localeCompare(aT); // newest first
  });
  const capped = merged.slice(0, PURCHASE_ORDER_CAP);
  await db.keyVal.put({ key: PURCHASE_ORDERS_KEY, value: JSON.stringify(capped) });
}

export async function getPurchaseOrdersFromDexie(
  page: number = 1,
  limit: number = 10
): Promise<{ data: PurchaseOrder[]; total: number }> {
  if (typeof window === 'undefined') {
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
  newStatus: 'pending' | 'completed' | 'cancelled'
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const record = await db.keyVal.get(PURCHASE_ORDERS_KEY);
  const all: PurchaseOrder[] = record?.value ? JSON.parse(record.value) : [];
  const updated = all.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
  await db.keyVal.put({ key: PURCHASE_ORDERS_KEY, value: JSON.stringify(updated) });
}

export async function getProductsFromDexie(
  page: number,
  limit: number,
  storeIdForOffline?: string | null
): Promise<{ data: ApiProduct[]; meta: PaginationMeta }> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const categories = await db.categoryCache.toArray();

  let rawData: unknown[];
  let total: number;

  if (storeIdForOffline != null && storeIdForOffline !== '') {
    const all = await db.productCache.orderBy('createdAt').reverse().toArray();
    const storeIdStr = String(storeIdForOffline);
    const filtered = all.filter((p: { storeId?: string | number | null }) => {
      const sid = p.storeId;
      if (sid == null || sid === '') return false;
      return String(sid) === storeIdStr;
    });
    total = filtered.length;
    const start = (page - 1) * limit;
    rawData = filtered.slice(start, start + limit);
  } else {
    total = await db.productCache.count();
    rawData = await db.productCache
      .orderBy('createdAt')
      .reverse()
      .offset((page - 1) * limit)
      .limit(limit)
      .toArray();
  }

  const data = (rawData as unknown as ApiProduct[]).map((product) => {
    const hasCategory = product.category != null && (typeof product.category === 'string' ? product.category.trim() !== '' : (product.category as { name?: string })?.name);
    if (product.categoryId && !hasCategory) {
      const category = categories.find((c) => String(c.id) === String(product.categoryId));
      if (category) {
        return { ...product, category: (category as ApiCategory).name };
      }
    }
    return product;
  });
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
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.customers.toArray();
  if (storeId != null && storeId !== '') {
    all = all.filter((c) => (c as Customer).storeId === storeId);
  }
  all.sort((a, b) => {
    const aT = (a as Customer).updatedAt ?? '';
    const bT = (b as Customer).updatedAt ?? '';
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
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.transactionCache.toArray();
  if (storeId != null && storeId !== '') {
    all = all.filter((t) => (t as Transaction & { storeId?: string }).storeId === storeId);
  }
  const sorted = (all as { date?: string }[]).sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '')
  );
  const total = sorted.length;
  const data = sorted.slice((page - 1) * limit, page * limit) as unknown as Transaction[];
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
