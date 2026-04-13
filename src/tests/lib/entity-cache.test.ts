import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb, resetDbInstanceForTests } from '@/lib/db';
import type { ApiProduct, ApiCategory } from '@/types/catalogue';
import type { Customer, PurchaseOrder } from '@/types';
import type { Transaction } from '@/types';
import {
  saveProductsToDexie,
  getProductsFromDexie,
  saveCategoriesToDexie,
  getCategoriesFromDexie,
  saveCustomersToDexie,
  getCustomersFromDexie,
  saveTransactionsToDexie,
  getTransactionsFromDexie,
  updateProductStockInDexie,
  updateProductInDexie,
  deleteProductFromDexie,
  updateCategoryInDexie,
  deleteCategoryFromDexie,
  updateCustomerInDexie,
  deleteCustomerFromDexie,
  getLastSyncAt,
  setLastSyncAt,
  savePurchaseOrdersToDexie,
  getPurchaseOrdersFromDexie,
  updatePurchaseOrderStatusInDexie,
  isTempEntityId,
} from '@/lib/entity-cache';

function product(i: number, createdAt: string, storeId?: string): ApiProduct {
  return {
    id: `pid-${i}`,
    name: `Product ${i}`,
    categoryId: 'cat',
    price: 1,
    costPrice: 0,
    stock: 10,
    barCode: i % 2 === 0 ? `code-${i}` : null,
    productImage: null,
    createdAt,
    updatedAt: createdAt,
    ...(storeId != null ? { storeId } : {}),
  };
}

function category(i: number, createdAt: string): ApiCategory {
  return {
    id: `cid-${i}`,
    name: `Cat ${i}`,
    createdAt,
    updatedAt: createdAt,
  };
}

function customer(id: string, updatedAt: string, storeId?: string): Customer {
  return {
    id,
    name: `User ${id}`,
    contact: `u${id}@x.com`,
    loyaltyPoints: 0,
    createdAt: updatedAt,
    updatedAt,
    ...(storeId != null ? { storeId } : {}),
  };
}

describe('entity-cache', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    await resetDbInstanceForTests();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetDbInstanceForTests();
  });

  it('isTempEntityId detects temp- prefix', () => {
    expect(isTempEntityId('temp-abc')).toBe(true);
    expect(isTempEntityId('uuid-here')).toBe(false);
    expect(isTempEntityId(null)).toBe(false);
  });

  it('getLastSyncAt / setLastSyncAt round-trip', async () => {
    expect(await getLastSyncAt('products')).toBeNull();
    await setLastSyncAt('products', '2024-06-01T00:00:00.000Z');
    expect(await getLastSyncAt('products')).toBe('2024-06-01T00:00:00.000Z');
  });

  it('getCategoriesFromDexie paginates and filters by storeId', async () => {
    await saveCategoriesToDexie([category(1, '2024-01-02T00:00:00.000Z'), category(2, '2024-01-01T00:00:00.000Z')], 'store-a');
    await saveCategoriesToDexie([category(3, '2024-01-03T00:00:00.000Z')], 'store-b');
    const p1 = await getCategoriesFromDexie(1, 1, 'store-a');
    expect(p1.meta.total).toBe(2);
    expect(p1.data).toHaveLength(1);
    const p2 = await getCategoriesFromDexie(1, 10, 'store-a');
    expect(p2.data.map((c) => c.id).sort()).toEqual(['cid-1', 'cid-2']);
  });

  it('getProductsFromDexie paginates, filters by store, search and categoryId', async () => {
    await saveCategoriesToDexie(
      [
        {
          id: 'cat-x',
          name: 'X',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      's1'
    );
    const p1 = product(1, '2024-01-01T00:00:00.000Z', 's1');
    p1.categoryId = 'cat-x';
    p1.name = 'Alpha juice';
    const p2 = product(2, '2024-01-02T00:00:00.000Z', 's1');
    p2.categoryId = 'cat-x';
    p2.name = 'Beta';
    p2.barCode = 'zzunique';
    const p3 = product(3, '2024-01-03T00:00:00.000Z', 's2');
    await saveProductsToDexie([p1, p2, p3], 's1');

    const all = await getProductsFromDexie(1, 10, 's1');
    expect(all.meta.total).toBe(2);

    const bySearch = await getProductsFromDexie(1, 10, 's1', { search: 'alpha' });
    expect(bySearch.data).toHaveLength(1);
    expect(bySearch.data[0].name).toContain('Alpha');

    const byCode = await getProductsFromDexie(1, 10, 's1', { search: 'zzunique' });
    expect(byCode.data).toHaveLength(1);

    const byCat = await getProductsFromDexie(1, 10, 's1', { categoryId: 'cat-x' });
    expect(byCat.meta.total).toBe(2);
  });

  it('updateProductStockInDexie, updateProductInDexie, deleteProductFromDexie', async () => {
    const p = product(1, '2024-01-01T00:00:00.000Z', 's1');
    await saveProductsToDexie([p], 's1');
    await updateProductStockInDexie('pid-1', 99);
    let row = await getDb().productCache.get('pid-1');
    expect(row?.stock).toBe(99);
    await updateProductInDexie('pid-1', { name: 'Renamed' });
    row = await getDb().productCache.get('pid-1');
    expect(row?.name).toBe('Renamed');
    await deleteProductFromDexie('pid-1');
    expect(await getDb().productCache.get('pid-1')).toBeUndefined();
  });

  it('updateCategoryInDexie and deleteCategoryFromDexie', async () => {
    await saveCategoriesToDexie([category(1, '2024-01-01T00:00:00.000Z')], 's1');
    await updateCategoryInDexie('cid-1', { name: 'NewName' });
    expect((await getDb().categoryCache.get('cid-1'))?.name).toBe('NewName');
    await deleteCategoryFromDexie('cid-1');
    expect(await getDb().categoryCache.get('cid-1')).toBeUndefined();
  });

  it('getCustomersFromDexie filters by search and storeId', async () => {
    await saveCustomersToDexie([
      customer('1', '2024-02-01T00:00:00.000Z', 'st1'),
      customer('2', '2024-02-02T00:00:00.000Z', 'st1'),
    ]);
    await getDb().customers.put(customer('3', '2024-02-03T00:00:00.000Z', 'st2'));

    const st1 = await getCustomersFromDexie(1, 10, undefined, 'st1');
    expect(st1.meta.total).toBe(2);

    const search = await getCustomersFromDexie(1, 10, 'User 1', undefined);
    expect(search.data.some((c) => c.id === '1')).toBe(true);
  });

  it('updateCustomerInDexie and deleteCustomerFromDexie', async () => {
    await saveCustomersToDexie([customer('c1', '2024-01-01T00:00:00.000Z')]);
    await updateCustomerInDexie('c1', { name: 'N2' });
    expect((await getDb().customers.get('c1'))?.name).toBe('N2');
    await deleteCustomerFromDexie('c1');
    expect(await getDb().customers.get('c1')).toBeUndefined();
  });

  it('getTransactionsFromDexie paginates and filters storeId', async () => {
    const t1: Transaction = {
      id: 'tx1',
      items: [],
      total: 1,
      paymentMethod: 'Cash',
      storeId: 's1',
      createdAt: '2024-01-02T00:00:00.000Z',
    };
    const t2: Transaction = {
      id: 'tx2',
      items: [],
      total: 2,
      paymentMethod: 'Cash',
      storeId: 's2',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    await saveTransactionsToDexie([t1, t2]);
    const s1 = await getTransactionsFromDexie(1, 10, 's1');
    expect(s1.meta.total).toBe(1);
    expect(s1.data[0].id).toBe('tx1');
  });

  it('savePurchaseOrdersToDexie merges and updatePurchaseOrderStatusInDexie works', async () => {
    const base = {
      orderCode: 'OC',
      items: [] as PurchaseOrder['items'],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      deliveryMethod: 'collection' as const,
      storeId: 's',
    };
    const o1: PurchaseOrder = {
      ...base,
      id: 'o1',
      orderCode: 'OC1',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const o2: PurchaseOrder = {
      ...base,
      id: 'o2',
      orderCode: 'OC2',
      status: 'pending',
      createdAt: '2024-01-02T00:00:00.000Z',
    };
    await savePurchaseOrdersToDexie([o1]);
    await savePurchaseOrdersToDexie([o2]);
    let list = await getPurchaseOrdersFromDexie(1, 10);
    expect(list.total).toBe(2);
    await updatePurchaseOrderStatusInDexie('o1', 'completed');
    list = await getPurchaseOrdersFromDexie(1, 10);
    expect(list.data.find((o) => o.id === 'o1')?.status).toBe('completed');
  });

  it('evicts oldest product cache rows when count exceeds test cap (KASIPOS_TEST_ENTITY_CAP)', async () => {
    vi.stubEnv('KASIPOS_TEST_ENTITY_CAP', '3');
    await saveProductsToDexie(
      [
        product(0, '2019-01-01T00:00:00.000Z', 's-cap'),
        product(1, '2020-01-01T00:00:00.000Z', 's-cap'),
        product(2, '2021-01-01T00:00:00.000Z', 's-cap'),
      ],
      's-cap'
    );
    expect(await getDb().productCache.count()).toBe(3);
    await saveProductsToDexie([product(3, '2022-01-01T00:00:00.000Z', 's-cap')], 's-cap');
    expect(await getDb().productCache.count()).toBe(3);
    expect(await getDb().productCache.get('pid-0')).toBeUndefined();
    expect(await getDb().productCache.get('pid-3')).toBeDefined();
  });

  it('evicts oldest customers when over test cap', async () => {
    vi.stubEnv('KASIPOS_TEST_ENTITY_CAP', '2');
    await saveCustomersToDexie([
      customer('a', '2018-01-01T00:00:00.000Z'),
      customer('b', '2019-01-01T00:00:00.000Z'),
      customer('c', '2020-01-01T00:00:00.000Z'),
    ]);
    const ids = (await getDb().customers.toArray()).map((c) => c.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('evicts oldest transactions when over test cap', async () => {
    vi.stubEnv('KASIPOS_TEST_ENTITY_CAP', '2');
    const mk = (id: string, dateIso: string, storeId: string): Transaction => ({
      id,
      items: [],
      total: 1,
      paymentMethod: 'Cash',
      storeId,
      date: new Date(dateIso),
    });
    await saveTransactionsToDexie([
      mk('a', '2018-01-01T00:00:00.000Z', 's'),
      mk('b', '2019-01-01T00:00:00.000Z', 's'),
      mk('c', '2020-01-01T00:00:00.000Z', 's'),
    ]);
    expect(await getDb().transactionCache.count()).toBe(2);
    expect(await getDb().transactionCache.get('a')).toBeUndefined();
  });

  it('evicts oldest categories when over test cap', async () => {
    vi.stubEnv('KASIPOS_TEST_ENTITY_CAP', '2');
    await saveCategoriesToDexie(
      [
        { id: 'c-old', name: 'O', createdAt: '2018-01-01T00:00:00.000Z', updatedAt: '2018-01-01T00:00:00.000Z' },
        { id: 'c-mid', name: 'M', createdAt: '2019-01-01T00:00:00.000Z', updatedAt: '2019-01-01T00:00:00.000Z' },
        { id: 'c-new', name: 'N', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
      ],
      'st'
    );
    expect(await getDb().categoryCache.count()).toBe(2);
    expect(await getDb().categoryCache.get('c-old')).toBeUndefined();
  });
});
