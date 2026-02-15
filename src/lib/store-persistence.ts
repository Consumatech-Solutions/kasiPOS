'use client';

import type { Store } from '@/types';
import { getDb } from '@/lib/db';
import type { StoreRecord } from '@/lib/db';

/**
 * Save store permanently to both localStorage (via SettingsProvider) and IndexedDB
 * This ensures the store is available offline and persists across sessions
 */
export async function saveStorePermanently(
  store: Store,
  setSetting?: (key: 'currentStore', value: Store | null) => void
): Promise<void> {
  if (!store || !store.id) {
    console.warn('[StorePersistence] Cannot save store: invalid store data');
    return;
  }

  try {
    // 1. Save to localStorage via SettingsProvider (if setSetting is provided)
    if (setSetting) {
      setSetting('currentStore', store);
    } else {
      // Fallback: save directly to localStorage if setSetting not available
      try {
        const settingsItem = localStorage.getItem('kasi-pos-settings');
        const settings = settingsItem ? JSON.parse(settingsItem) : {};
        settings.currentStore = store;
        localStorage.setItem('kasi-pos-settings', JSON.stringify(settings));
      } catch (error) {
        console.warn('[StorePersistence] Failed to save store to localStorage:', error);
      }
    }

    // 2. Save to IndexedDB for permanent offline storage
    if (typeof window !== 'undefined') {
      try {
        const db = getDb();
        const storeRecord: StoreRecord = {
          ...store,
          synced: true,
          lastSyncedAt: new Date().toISOString(),
        };

        // Use put to update if exists, or add if new
        await db.stores.put(storeRecord, store.id);
        console.log('[StorePersistence] Store saved to IndexedDB:', store.id);
      } catch (error) {
        console.error('[StorePersistence] Failed to save store to IndexedDB:', error);
        // Don't throw - localStorage is more critical
      }
    }
  } catch (error) {
    console.error('[StorePersistence] Error saving store permanently:', error);
    // Don't throw - allow app to continue even if persistence fails
  }
}

/**
 * Load store from IndexedDB
 * Used as fallback when API is unavailable
 * @param storeId - Store ID (number for legacy, string UUID for store_admin)
 */
export async function loadStoreFromIndexedDB(storeId?: string | number | null): Promise<Store | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const db = getDb();
    if (storeId != null && storeId !== '') {
      // Load specific store by ID (number or UUID string)
      const store = await db.stores.get(storeId as number);
      if (store) {
        console.log('[StorePersistence] Loaded store from IndexedDB:', storeId);
        return store as Store;
      }
    } else {
      // Load the first store (typically user has one store)
      const stores = await db.stores.toArray();
      if (stores.length > 0) {
        console.log('[StorePersistence] Loaded store from IndexedDB (first available)');
        return stores[0] as Store;
      }
    }
  } catch (error) {
    console.error('[StorePersistence] Error loading store from IndexedDB:', error);
  }

  return null;
}

/**
 * Fetch store from API and save permanently
 * This is the main function to use after authentication
 */
export async function fetchAndSaveStore(
  setSetting?: (key: 'currentStore', value: Store | null) => void
): Promise<Store | null> {
  try {
    const { storesApi } = await import('@/lib/api/stores');
    const response = await storesApi.getMyStore();
    const store = response.data;

    if (store) {
      await saveStorePermanently(store, setSetting);
      return store;
    }
  } catch (error: any) {
    console.error('[StorePersistence] Error fetching store:', error);
    
    // Try to load from IndexedDB as fallback
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.log('[StorePersistence] Network error - attempting to load from IndexedDB');
      const cachedStore = await loadStoreFromIndexedDB();
      if (cachedStore && setSetting) {
        setSetting('currentStore', cachedStore);
        return cachedStore;
      }
    }
  }

  return null;
}

