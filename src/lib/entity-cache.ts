/**
 * Entity cache: persist API data to Dexie with cap, read when offline.
 */

import { getDb } from '@/lib/db';
import type { PaginationMeta } from '@/types/pagination';
import type { ApiProduct } from '@/types/catalogue';
import type { Customer, PurchaseOrder } from '@/types';
import type { Transaction } from '@/types';

const ENTITY_CAP = 10000;
const PURCHASE_ORDERS_KEY = 'purchaseOrders';
const PURCHASE_ORDER_CAP = 1000;

export async function saveProductsToDexie(data: ApiProduct[]): Promise<void> {
  if (typeof window === 'undefined' || !data.length) return;
  const db = getDb();
  const records = data.map((p) => ({
    ...p,
    id: p.id,
    createdAt: p.createdAt ?? new Date().toISOString(),
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
  limit: number
): Promise<{ data: ApiProduct[]; meta: PaginationMeta }> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const total = await db.productCache.count();
  const data = await db.productCache
    .orderBy('createdAt')
    .reverse()
    .offset((page - 1) * limit)
    .limit(limit)
    .toArray();
  return {
    data: data as unknown as ApiProduct[],
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
  search?: string
): Promise<{ data: Customer[]; meta: PaginationMeta }> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  let all = await db.customers.toArray();
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
  limit: number
): Promise<{ data: Transaction[]; meta: PaginationMeta }> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
  const db = getDb();
  const total = await db.transactionCache.count();
  const data = await db.transactionCache
    .orderBy('date')
    .reverse()
    .offset((page - 1) * limit)
    .limit(limit)
    .toArray();
  return {
    data: data as unknown as Transaction[],
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
