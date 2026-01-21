'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { storesApi } from '@/lib/api/stores';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';

export function useStore() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger depuis IndexedDB avec useLiveQuery
  const stores = useLiveQuery(
    () => db.stores.toArray(),
    []
  ) || [];

  const storeRecord = stores.length > 0 ? stores[0] : null;
  // Convertir StoreRecord en Store (enlever synced et lastSyncedAt)
  const store: Store | null = storeRecord ? {
    id: storeRecord.id,
    name: storeRecord.name,
    vatNumber: storeRecord.vatNumber,
    logoUrl: storeRecord.logoUrl,
    receiptHeader: storeRecord.receiptHeader,
    receiptFooter: storeRecord.receiptFooter,
    isSetupComplete: storeRecord.isSetupComplete,
    ownerId: storeRecord.ownerId,
    createdAt: storeRecord.createdAt,
    updatedAt: storeRecord.updatedAt,
  } : null;
  const hasStore = !!store;

  const loadStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Synchroniser avec le backend si en ligne
      if (navigator.onLine) {
        try {
          const response = await storesApi.getMyStore();
          const serverStore = response.data;
          
          // Mettre à jour IndexedDB
          await db.stores.put({
            ...serverStore,
            synced: true,
            lastSyncedAt: new Date().toISOString(),
          } as StoreRecord);
        } catch (err: any) {
          // 404 signifie qu'aucun magasin n'existe pour cet utilisateur
          if (err?.response?.status === 404) {
            // Supprimer de IndexedDB si présent
            if (stores.length > 0 && stores[0].id) {
              await db.stores.delete(stores[0].id);
            }
          } else if (err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
            console.error('Erreur lors du chargement du magasin:', err);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [stores.length]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const createStore = useCallback(async (data: CreateStoreDto) => {
    try {
      if (!navigator.onLine) {
        throw new Error('Création de magasin nécessite une connexion internet');
      }

      const response = await storesApi.create(data);
      const created = response.data;

      // Stocker dans IndexedDB
      await db.stores.put({
        ...created,
        synced: true,
        lastSyncedAt: new Date().toISOString(),
      } as StoreRecord);

      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      throw err;
    }
  }, []);

  const updateStore = useCallback(async (id: number, data: UpdateStoreDto) => {
    try {
      if (!store) {
        throw new Error('Aucun magasin à mettre à jour');
      }

      const updated: Store = {
        ...store,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      // Mettre à jour localement
      await db.stores.update(id, {
        ...updated,
        synced: false,
      } as Partial<StoreRecord>);

      // Synchroniser si en ligne
      if (navigator.onLine) {
        try {
          const response = await storesApi.update(id, data);
          const serverUpdated = response.data;
          
          await db.stores.update(id, {
            ...serverUpdated,
            synced: true,
            lastSyncedAt: new Date().toISOString(),
          } as Partial<StoreRecord>);
        } catch (err) {
          console.error('Erreur lors de la mise à jour sur le serveur:', err);
        }
      }

      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  }, [store]);

  return {
    store,
    hasStore,
    loading,
    error,
    createStore,
    updateStore,
    refresh: loadStore,
  };
}
