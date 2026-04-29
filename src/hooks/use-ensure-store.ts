"use client";

import { useState } from "react";
import { useSettings } from "@/components/settings-provider";
import { storesApi } from "@/lib/api/stores";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import {
  saveStorePermanently,
  loadStoreFromIndexedDB,
} from "@/lib/store-persistence";
import { isNetworkErrorLike } from "@/lib/network-error";
import type { Store } from "@/types";

export function useEnsureStore() {
  const { settings, setSetting } = useSettings();
  const [isLoading, setIsLoading] = useState(false);

  const ensureStore = async (): Promise<Store | null> => {
    const loadCachedStore = async (storeId?: string | null) => {
      const cachedStore = await loadStoreFromIndexedDB(storeId);
      if (cachedStore) {
        setSetting("currentStore", cachedStore);
        return cachedStore;
      }
      return null;
    };

    const jwtStoreId = settings.currentUser?.storeId;
    const current = settings.currentStore;

    if (current && jwtStoreId && current.id !== jwtStoreId) {
      if (typeof window !== "undefined" && !navigator.onLine) {
        const cached = await loadStoreFromIndexedDB(jwtStoreId);
        if (cached) {
          setSetting("currentStore", cached);
          return cached;
        }
      }
      setIsLoading(true);
      try {
        const response = await storesApi.getById(jwtStoreId);
        let store = response.data;
        if (store) {
          const { settingsApi } = await import("@/lib/api/settings");
          try {
            const settingsRes = await settingsApi.get(store.id);
            const raw = settingsRes.data as {
              credit?: Store["credit"];
              data?: { credit?: Store["credit"] };
            };
            const credit = raw?.data?.credit ?? raw?.credit;
            if (credit !== undefined) store = { ...store, credit };
          } catch (_) {}
          await saveStorePermanently(store, setSetting);
          setSetting("currentStore", store);
          setIsLoading(false);
          return store;
        }
      } catch (err) {
        if (isNetworkErrorLike(err)) {
          const cached = await loadCachedStore(jwtStoreId);
          if (cached) {
            setIsLoading(false);
            return cached;
          }
        }
        setIsLoading(false);
        return current;
      }
    }

    if (current) {
      return current;
    }

    if (typeof window !== "undefined" && !navigator.onLine) {
      const cachedStore = await loadCachedStore(settings.currentUser?.storeId);
      if (cachedStore) return cachedStore;
      feedback.error(
        "Offline",
        "Cannot fetch store while offline.",
        "Check your connection and try again.",
        { code: ERROR_CODES.STORE }
      );
      return null;
    }

    setIsLoading(true);
    try {
      const response = await storesApi.getMyStore();
      const store = response.data;

      await saveStorePermanently(store, setSetting);

      setIsLoading(false);
      return store;
    } catch (error: unknown) {
      setIsLoading(false);

      if (isNetworkErrorLike(error)) {
        const cachedStore = await loadCachedStore(
          settings.currentUser?.storeId
        );
        if (cachedStore) {
          feedback.success(
            "Using cached store",
            "Loaded store from offline cache."
          );
          return cachedStore;
        }
      }
      feedback.fromError(
        error,
        "Failed to load store",
        "Check your connection and try again.",
        ERROR_CODES.STORE
      );
      return null;
    }
  };

  return {
    ensureStore,
    currentStore: settings.currentStore,
    isLoading,
  };
}
