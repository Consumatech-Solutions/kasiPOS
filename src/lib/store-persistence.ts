"use client";

import type { Store } from "@/types";
import { getDb } from "@/lib/db";
import type { StoreRecord } from "@/lib/db";

export async function saveStorePermanently(
  store: Store,
  setSetting?: (key: "currentStore", value: Store | null) => void
): Promise<void> {
  if (!store || !store.id) {
    console.warn("[StorePersistence] Cannot save store: invalid store data");
    return;
  }

  try {
    if (setSetting) {
      setSetting("currentStore", store);
    } else {
      try {
        const settingsItem = localStorage.getItem("kasi-pos-settings");
        const settings = settingsItem ? JSON.parse(settingsItem) : {};
        settings.currentStore = store;
        localStorage.setItem("kasi-pos-settings", JSON.stringify(settings));
      } catch (error) {
        console.warn(
          "[StorePersistence] Failed to save store to localStorage:",
          error
        );
      }
    }

    if (typeof window !== "undefined") {
      try {
        const db = getDb();
        const storeRecord: StoreRecord = {
          ...store,
          synced: true,
          lastSyncedAt: new Date().toISOString(),
        };

        await db.stores.put(storeRecord, store.id);
        console.log("[StorePersistence] Store saved to IndexedDB:", store.id);
      } catch (error) {
        console.error(
          "[StorePersistence] Failed to save store to IndexedDB:",
          error
        );
      }
    }
  } catch (error) {
    console.error("[StorePersistence] Error saving store permanently:", error);
  }
}

export async function loadStoreFromIndexedDB(
  storeId?: string | number | null
): Promise<Store | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const db = getDb();
    if (storeId != null && storeId !== "") {
      const store = await db.stores.get(storeId);
      if (store) {
        console.log("[StorePersistence] Loaded store from IndexedDB:", storeId);
        return store as Store;
      }
    } else {
      const stores = await db.stores.toArray();
      if (stores.length > 0) {
        console.log(
          "[StorePersistence] Loaded store from IndexedDB (first available)"
        );
        return stores[0] as Store;
      }
    }
  } catch (error) {
    console.error(
      "[StorePersistence] Error loading store from IndexedDB:",
      error
    );
  }

  return null;
}

export async function fetchAndSaveStore(
  setSetting?: (key: "currentStore", value: Store | null) => void,
  preferredStoreId?: string | number | null
): Promise<Store | null> {
  try {
    const { storesApi } = await import("@/lib/api/stores");
    const response = await storesApi.getMyStore();
    let store = response.data;

    if (store) {
      try {
        const { settingsApi } = await import("@/lib/api/settings");
        const settingsRes = await settingsApi.get(store.id);
        const raw = settingsRes.data as {
          credit?: Store["credit"];
          data?: { credit?: Store["credit"] };
        };
        const credit = raw?.data?.credit ?? raw?.credit ?? undefined;
        if (credit !== undefined) {
          store = { ...store, credit };
        }
      } catch (_) {}
      await saveStorePermanently(store, setSetting);
      return store;
    }
  } catch (error: any) {
    const isNetworkFailure =
      error?.isNetworkError === true ||
      error?.name === "NetworkError" ||
      error?.code === "ERR_NETWORK" ||
      error?.message === "Network Error" ||
      error?.message?.includes("Network request failed");

    if (isNetworkFailure) {
      const cachedStore = await loadStoreFromIndexedDB(
        preferredStoreId ?? undefined
      );
      if (cachedStore && setSetting) {
        setSetting("currentStore", cachedStore);
        return cachedStore;
      }
      return null;
    }
    console.error("[StorePersistence] Error fetching store:", error);
  }

  return null;
}
