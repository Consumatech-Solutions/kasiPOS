/**
 * Pull products, categories, customers, and vouchers from the API into Dexie and TanStack Query.
 * Used for scheduled sync, manual "download from cloud", and one-time initial hydration.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { Voucher } from "@/types";
import type { PaginationMeta } from "@/types/pagination";
import { vouchersApi } from "@/lib/api/vouchers";
import {
  getLastSyncAt,
  setLastSyncAt,
  getProductsFromDexie,
  getCategoriesFromDexie,
  getCustomersFromDexie,
  purgeTempIdCatalogueRowsAfterCloudSync,
} from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import { offlineDetector } from "@/lib/offline-detector";
import {
  pullAllProductsFromApi,
  pullAllCategoriesFromApi,
  pullAllCustomersFromApi,
} from "@/lib/catalogue-network-hydrate";

const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [...productKeys.lists(), filters] as const,
};

const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [...categoryKeys.lists(), filters] as const,
};

const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (filters?: { page?: number; limit?: number; search?: string }) =>
    [...customerKeys.lists(), filters] as const,
};

const voucherKeys = {
  all: ["vouchers"] as const,
  lists: () => [...voucherKeys.all, "list"] as const,
  list: (filters?: { page?: number; limit?: number; isActive?: boolean }) =>
    [...voucherKeys.lists(), filters] as const,
};

export const CLOUD_SYNC_LOCAL_HOURS = [6, 12, 18] as const;

const DAILY_SLOTS_STORAGE_KEY = "kasipos-daily-sync-slots";

function readCompletedSlots(): Record<string, true> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(DAILY_SLOTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, true>)
      : {};
  } catch {
    return {};
  }
}

function markSlotCompleted(slotId: string): void {
  if (typeof localStorage === "undefined") return;
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
 * Returns a due, uncompleted scheduled slot id (6, 12, 18 local time).
 * Supports catch-up: if the app was offline at slot time, the slot remains due
 * and will run at the next online opportunity.
 */
export function getNextDueScheduledSyncSlotId(
  now: Date = new Date(),
): string | null {
  if (typeof window === "undefined") return null;
  const completed = readCompletedSlots();

  // Check yesterday + today to catch up overnight/offline slots.
  for (const dayOffset of [1, 0]) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - dayOffset);
    const dayKey = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;

    for (const h of CLOUD_SYNC_LOCAL_HOURS) {
      const slotTime = new Date(day);
      slotTime.setHours(h, 0, 0, 0);
      if (slotTime > now) continue;
      const slotId = `${dayKey}-${h}`;
      if (!completed[slotId]) return slotId;
    }
  }

  return null;
}

/** Backward-compatible alias. */
export function getCurrentScheduledSyncSlotId(): string | null {
  return getNextDueScheduledSyncSlotId();
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
export async function runCloudDataPull(
  options: RunCloudDataPullOptions,
): Promise<void> {
  const { queryClient, storeId, onProgress } = options;
  const storeIdString =
    storeId != null && storeId !== "" ? String(storeId) : undefined;
  let completed = 0;
  const bump = () => {
    completed++;
    onProgress?.(completed, DATA_STEPS);
  };

  const lastProducts = await getLastSyncAt("products");
  await pullAllProductsFromApi(storeIdString ?? "", {
    ...(storeIdString
      ? { storeIdQueryParam: true }
      : { storeIdQueryParam: false }),
    ...(lastProducts ? { updatedAtAfter: lastProducts } : {}),
  });
  if (storeIdString) {
    const productCountCheck = await getProductsFromDexie(
      1,
      1,
      storeIdString,
      {},
    );
    if (productCountCheck.meta.total === 0) {
      try {
        const n = await pullAllProductsFromApi(storeIdString, {
          storeIdQueryParam: true,
        });
        if (n === 0)
          await pullAllProductsFromApi(storeIdString, {
            storeIdQueryParam: false,
          });
      } catch (e) {
        console.warn(
          "[cloud-data-pull] Full product hydrate after empty Dexie failed",
          e,
        );
      }
    }
  }
  await setLastSyncAt("products", new Date().toISOString());
  const productResult = await getProductsFromDexie(1, 100, storeIdString, {});
  queryClient.setQueryData(
    productKeys.list({ page: 1, limit: 100 }),
    productResult,
  );
  bump();

  const lastCategories = await getLastSyncAt("categories");
  await pullAllCategoriesFromApi(storeIdString ?? "", {
    ...(storeIdString
      ? { storeIdQueryParam: true }
      : { storeIdQueryParam: false }),
    ...(lastCategories ? { updatedAtAfter: lastCategories } : {}),
  });
  if (storeIdString) {
    const categoryCountCheck = await getCategoriesFromDexie(
      1,
      1,
      storeIdString,
    );
    if (categoryCountCheck.meta.total === 0) {
      try {
        const n = await pullAllCategoriesFromApi(storeIdString, {
          storeIdQueryParam: true,
        });
        if (n === 0)
          await pullAllCategoriesFromApi(storeIdString, {
            storeIdQueryParam: false,
          });
      } catch (e) {
        console.warn(
          "[cloud-data-pull] Full category hydrate after empty Dexie failed",
          e,
        );
      }
    }
  }
  await setLastSyncAt("categories", new Date().toISOString());
  const categoryResult = await getCategoriesFromDexie(1, 50, storeIdString);
  queryClient.setQueryData(
    categoryKeys.list({ page: 1, limit: 50 }),
    categoryResult,
  );
  bump();

  const lastCustomers = await getLastSyncAt("customers");
  await pullAllCustomersFromApi({
    ...(storeIdString ? { storeId: storeIdString } : {}),
    ...(lastCustomers ? { updatedAtAfter: lastCustomers } : {}),
  });
  await setLastSyncAt("customers", new Date().toISOString());
  const customerResult = await getCustomersFromDexie(
    1,
    50,
    undefined,
    storeIdString,
  );
  queryClient.setQueryData(
    customerKeys.list({ page: 1, limit: 50 }),
    customerResult,
  );
  bump();

  const purgeTemp = await purgeTempIdCatalogueRowsAfterCloudSync(
    storeId ?? undefined,
  );
  if (
    process.env.NODE_ENV === "development" &&
    (purgeTemp.productsRemoved > 0 ||
      purgeTemp.categoriesRemoved > 0 ||
      purgeTemp.customersRemoved > 0)
  ) {
    console.log(
      "[cloud-data-pull] Removed local temp-id catalogue rows after sync",
      purgeTemp,
    );
  }

  const voucherResponse = await vouchersApi.getAll({
    page: 1,
    limit: 50,
    isActive: true,
  });
  const voucherData = voucherResponse.data;
  let voucherNormalized: { data: Voucher[]; meta: PaginationMeta };
  if (
    voucherData &&
    typeof voucherData === "object" &&
    "data" in voucherData &&
    "meta" in voucherData
  ) {
    voucherNormalized = voucherData as unknown as {
      data: Voucher[];
      meta: PaginationMeta;
    };
  } else {
    const data = Array.isArray(voucherData) ? (voucherData as Voucher[]) : [];
    voucherNormalized = {
      data,
      meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
    };
  }
  queryClient.setQueryData(
    voucherKeys.list({ page: 1, limit: 50, isActive: true }),
    voucherNormalized,
  );
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
  const t = await getLastSyncAt("products");
  return t == null || t === "";
}

/** Upload queued changes, then download catalogue data (manual / UI). */
export async function runManualFullCloudSync(
  options: RunCloudDataPullOptions,
): Promise<void> {
  const hasConnectivity = await offlineDetector.forceCheck();
  if (!hasConnectivity) {
    throw new Error("No internet connection available for cloud sync.");
  }
  offlineDetector.setOfflineFirstActive(false);
  try {
    await mutationQueue.processQueue({ force: true });
    await runCloudDataPull(options);
  } finally {
    offlineDetector.setOfflineFirstActive(true);
  }
}

/** Upload queued changes only (manual push), without toggling offline-first mode. */
export async function runManualPushSync() {
  const hasConnectivity = await offlineDetector.forceCheck();
  if (!hasConnectivity) {
    throw new Error("No internet connection available for cloud sync.");
  }
  return await mutationQueue.processQueue({ force: true });
}
