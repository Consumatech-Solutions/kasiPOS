/**
 * Pull products, categories, customers, and vouchers from the API into Dexie and TanStack Query.
 * Used for scheduled sync, manual "download from cloud", and one-time initial hydration.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { Voucher } from '@/types';
import type { PaginationMeta } from '@/types/pagination';
import { catalogueApi } from '@/lib/api/catalogue';
import { customersApi } from '@/lib/api/customers';
import { vouchersApi } from '@/lib/api/vouchers';
import {
  saveProductsToDexie,
  saveCategoriesToDexie,
  saveCustomersToDexie,
  getLastSyncAt,
  setLastSyncAt,
  getProductsFromDexie,
  getCategoriesFromDexie,
  getCustomersFromDexie,
} from '@/lib/entity-cache';
import { mutationQueue } from '@/lib/mutation-queue';
import { pullAllProductsFromApi, pullAllCategoriesFromApi } from '@/lib/catalogue-network-hydrate';

const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...productKeys.lists(), filters] as const,
};

const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...categoryKeys.lists(), filters] as const,
};

const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string }) =>
    [...customerKeys.lists(), filters] as const,
};

const voucherKeys = {
  all: ['vouchers'] as const,
  lists: () => [...voucherKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; isActive?: boolean }) =>
    [...voucherKeys.lists(), filters] as const,
};

export const CLOUD_SYNC_LOCAL_HOURS = [6, 12, 18] as const;

const DAILY_SLOTS_STORAGE_KEY = 'kasipos-daily-sync-slots';

function readCompletedSlots(): Record<string, true> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DAILY_SLOTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function markSlotCompleted(slotId: string): void {
  if (typeof localStorage === 'undefined') return;
  const slots = readCompletedSlots();
  slots[slotId] = true;
  // Trim old keys (keep last ~14 days of slot ids)
  const keys = Object.keys(slots);
  if (keys.length > 42) {
    keys.sort();
    for (let i = 0; i < keys.length - 42; i++) delete slots[keys[i]];
  }
  localStorage.setItem(DAILY_SLOTS_STORAGE_KEY, JSON.stringify(slots));
}

/**
 * When in a scheduled local hour (6, 12, or 18) and that slot has not completed successfully yet, returns the slot id.
 * Call {@link markScheduledSyncSlotComplete} only after push + pull succeed.
 */
export function getCurrentScheduledSyncSlotId(): string | null {
  if (typeof window === 'undefined') return null;
  const now = new Date();
  const h = now.getHours();
  if (!CLOUD_SYNC_LOCAL_HOURS.includes(h as (typeof CLOUD_SYNC_LOCAL_HOURS)[number])) {
    return null;
  }
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const slotId = `${dayKey}-${h}`;
  if (readCompletedSlots()[slotId]) return null;
  return slotId;
}

export function markScheduledSyncSlotComplete(slotId: string): void {
  markSlotCompleted(slotId);
}

export interface RunCloudDataPullOptions {
  queryClient: QueryClient;
  storeId?: string | null;
  /** When set, reports progress via callback (completed, total). */
  onProgress?: (completed: number, total: number) => void;
}

const DATA_STEPS = 4;

/**
 * Fetches catalogue and related entities from the server, updates Dexie, and refreshes matching query cache entries.
 */
export async function runCloudDataPull(options: RunCloudDataPullOptions): Promise<void> {
  const { queryClient, storeId, onProgress } = options;
  let completed = 0;
  const bump = () => {
    completed++;
    onProgress?.(completed, DATA_STEPS);
  };

  const lastProducts = await getLastSyncAt('products');
  const productParams: { page: number; limit: number; updatedAtAfter?: string; storeId?: string } = {
    page: 1,
    limit: 100,
  };
  if (lastProducts) productParams.updatedAtAfter = lastProducts;
  if (storeId) productParams.storeId = String(storeId);
  const productResponse = await catalogueApi.products.getAll(productParams);
  const productDelta =
    'data' in productResponse && productResponse.data
      ? productResponse.data
      : Array.isArray(productResponse)
        ? productResponse
        : [];
  if (productDelta.length) await saveProductsToDexie(productDelta, storeId ?? undefined);
  if (storeId) {
    const productCountCheck = await getProductsFromDexie(1, 1, storeId, {});
    if (productCountCheck.meta.total === 0) {
      try {
        let n = await pullAllProductsFromApi(storeId, { storeIdQueryParam: true });
        if (n === 0) await pullAllProductsFromApi(storeId, { storeIdQueryParam: false });
      } catch (e) {
        console.warn('[cloud-data-pull] Full product hydrate after empty Dexie failed', e);
      }
    }
  }
  await setLastSyncAt('products', new Date().toISOString());
  const productResult = lastProducts
    ? await getProductsFromDexie(1, 100, storeId ?? undefined)
    : {
        data: productDelta,
        meta:
          'meta' in productResponse && productResponse.meta
            ? productResponse.meta
            : { total: productDelta.length, page: 1, limit: 100, totalPages: 1 },
      };
  queryClient.setQueryData(productKeys.list({ page: 1, limit: 100 }), productResult);
  bump();

  const lastCategories = await getLastSyncAt('categories');
  const categoryParams: { page: number; limit: number; updatedAtAfter?: string; storeId?: string } = {
    page: 1,
    limit: 50,
  };
  if (lastCategories) categoryParams.updatedAtAfter = lastCategories;
  if (storeId) categoryParams.storeId = String(storeId);
  const categoryResponse = await catalogueApi.categories.getAll(categoryParams);
  const categoryDelta =
    'data' in categoryResponse && categoryResponse.data
      ? categoryResponse.data
      : Array.isArray(categoryResponse)
        ? categoryResponse
        : [];
  if (categoryDelta.length) await saveCategoriesToDexie(categoryDelta, storeId ?? undefined);
  if (storeId) {
    const categoryCountCheck = await getCategoriesFromDexie(1, 1, storeId);
    if (categoryCountCheck.meta.total === 0) {
      try {
        let n = await pullAllCategoriesFromApi(storeId, { storeIdQueryParam: true });
        if (n === 0) await pullAllCategoriesFromApi(storeId, { storeIdQueryParam: false });
      } catch (e) {
        console.warn('[cloud-data-pull] Full category hydrate after empty Dexie failed', e);
      }
    }
  }
  await setLastSyncAt('categories', new Date().toISOString());
  const categoryResult = lastCategories
    ? await getCategoriesFromDexie(1, 50, storeId ?? undefined)
    : {
        data: categoryDelta,
        meta:
          'meta' in categoryResponse && categoryResponse.meta
            ? categoryResponse.meta
            : { total: categoryDelta.length, page: 1, limit: 50, totalPages: 1 },
      };
  queryClient.setQueryData(categoryKeys.list({ page: 1, limit: 50 }), categoryResult);
  bump();

  const lastCustomers = await getLastSyncAt('customers');
  const customerParams: { page: number; limit: number; updatedAtAfter?: string } = { page: 1, limit: 50 };
  if (lastCustomers) customerParams.updatedAtAfter = lastCustomers;
  const customersRes = await customersApi.getAll(customerParams);
  const responseData = customersRes.data;
  const customerDelta =
    responseData && 'data' in responseData
      ? responseData.data
      : Array.isArray(responseData)
        ? responseData
        : [];
  if (customerDelta.length) await saveCustomersToDexie(customerDelta);
  await setLastSyncAt('customers', new Date().toISOString());
  const customerResult = lastCustomers
    ? await getCustomersFromDexie(1, 50)
    : {
        data: customerDelta,
        meta:
          responseData && 'meta' in responseData
            ? responseData.meta
            : { total: customerDelta.length, page: 1, limit: 50, totalPages: 1 },
      };
  queryClient.setQueryData(customerKeys.list({ page: 1, limit: 50 }), customerResult);
  bump();

  const voucherResponse = await vouchersApi.getAll({ page: 1, limit: 50, isActive: true });
  const voucherData = voucherResponse.data;
  let voucherNormalized: { data: Voucher[]; meta: PaginationMeta };
  if (voucherData && typeof voucherData === 'object' && 'data' in voucherData && 'meta' in voucherData) {
    voucherNormalized = voucherData as unknown as { data: Voucher[]; meta: PaginationMeta };
  } else {
    const data = Array.isArray(voucherData) ? (voucherData as Voucher[]) : [];
    voucherNormalized = {
      data,
      meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
    };
  }
  queryClient.setQueryData(voucherKeys.list({ page: 1, limit: 50, isActive: true }), voucherNormalized);
  bump();

  // Refetch active queries from Dexie-backed queryFns (no network).
  await queryClient.invalidateQueries({ queryKey: productKeys.all });
  await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
  await queryClient.invalidateQueries({ queryKey: customerKeys.all });
  // Vouchers: only setQueryData above — invalidating would refetch via API in useVouchers.
}

/**
 * True when this device has never completed a product sync timestamp (first run or cleared data).
 */
export async function needsInitialCloudHydration(): Promise<boolean> {
  const t = await getLastSyncAt('products');
  return t == null || t === '';
}

/** Upload queued changes, then download catalogue data (manual / UI). */
export async function runManualFullCloudSync(options: RunCloudDataPullOptions): Promise<void> {
  await mutationQueue.processQueue();
  await runCloudDataPull(options);
}
