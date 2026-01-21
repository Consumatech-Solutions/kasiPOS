'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomerRecord } from '@/lib/db';
import { customersApi } from '@/lib/api/customers';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import type { PaginationMeta } from '@/types/pagination';

interface UseCustomersOptions {
  initialPage?: number;
  initialLimit?: number;
  searchQuery?: string;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { initialPage = 1, initialLimit = 10, searchQuery = '' } = options;
  
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: initialPage,
    limit: initialLimit,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger depuis IndexedDB avec useLiveQuery
  const allCustomers = useLiveQuery(
    () => db.customers.orderBy('name').toArray(),
    []
  ) || [];

  // Filtrer par recherche
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim() || !allCustomers) {
      return allCustomers || [];
    }

    const query = searchQuery.toLowerCase();
    return allCustomers.filter(
      customer =>
        customer.name?.toLowerCase().includes(query) ||
        customer.contact?.toLowerCase().includes(query)
    );
  }, [allCustomers, searchQuery]);

  // Pagination côté client
  const paginatedCustomers = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;
    return filteredCustomers.slice(start, end);
  }, [filteredCustomers, pagination.page, pagination.limit]);

  // Calculer les valeurs de pagination sans dépendre de l'état pagination
  const totalCustomers = filteredCustomers.length;
  const totalPages = Math.ceil(totalCustomers / pagination.limit);

  // Mettre à jour la pagination seulement si les valeurs ont changé
  useEffect(() => {
    setPagination(prev => {
      // Éviter les mises à jour inutiles si les valeurs n'ont pas changé
      if (prev.total === totalCustomers && prev.totalPages === totalPages) {
        return prev;
      }
      return {
        ...prev,
        total: totalCustomers,
        totalPages: totalPages,
      };
    });
  }, [totalCustomers, totalPages]);

  const loadCustomers = useCallback(async (page: number = initialPage, limit: number = initialLimit) => {
    try {
      setLoading(true);
      setError(null);

      // Synchroniser avec le backend si en ligne
      if (navigator.onLine) {
        try {
          const response = await customersApi.getAll({ page, limit });
          
          // Mettre à jour IndexedDB
          await db.customers.bulkPut(
            response.data.data.map(customer => ({
              ...customer,
              synced: true,
              lastSyncedAt: new Date().toISOString(),
            }))
          );

          setPagination(response.data.meta);
        } catch (err: any) {
          // Ne pas bloquer si le backend n'est pas disponible
          if (err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
            console.error('Erreur lors de la synchronisation des clients:', err);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [initialPage, initialLimit]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const createCustomer = useCallback(async (data: CreateCustomerDto) => {
    try {
      const localId = `local-${Date.now()}`;
      const newCustomer: Customer = {
        id: localId,
        name: data.name,
        contact: data.contact,
        loyaltyPoints: data.loyaltyPoints ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Ajouter localement
      await db.customers.add({
        ...newCustomer,
        synced: false,
      } as CustomerRecord);

      // Synchroniser si en ligne
      if (navigator.onLine) {
        try {
          const response = await customersApi.create(data);
          const created = response.data;
          
          // Supprimer l'entrée locale et ajouter celle du serveur
          await db.customers.delete(localId);
          await db.customers.add({
            ...created,
            synced: true,
            lastSyncedAt: new Date().toISOString(),
          } as CustomerRecord);
        } catch (err) {
          console.error('Erreur lors de la création sur le serveur:', err);
        }
      }

      return newCustomer;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      throw err;
    }
  }, []);

  const updateCustomer = useCallback(async (id: string, data: UpdateCustomerDto) => {
    try {
      const existing = await db.customers.get(id);
      if (!existing) {
        throw new Error('Client non trouvé');
      }

      const updated: Customer = {
        ...existing as any,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      // Mettre à jour localement
      await db.customers.update(id, {
        ...updated,
        synced: false,
      } as Partial<CustomerRecord>);

      // Synchroniser si en ligne
      if (navigator.onLine) {
        try {
          const response = await customersApi.update(id, data);
          const serverUpdated = response.data;
          
          await db.customers.update(id, {
            ...serverUpdated,
            synced: true,
            lastSyncedAt: new Date().toISOString(),
          } as Partial<CustomerRecord>);
        } catch (err) {
          console.error('Erreur lors de la mise à jour sur le serveur:', err);
        }
      }

      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      await db.customers.delete(id);

      if (navigator.onLine) {
        try {
          await customersApi.delete(id);
        } catch (err) {
          console.error('Erreur lors de la suppression sur le serveur:', err);
        }
      }

      await loadCustomers(pagination.page, pagination.limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      throw err;
    }
  }, [pagination.page, pagination.limit, loadCustomers]);

  return {
    customers: paginatedCustomers,
    allCustomers: filteredCustomers,
    pagination,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: () => loadCustomers(pagination.page, pagination.limit),
    loadPage: (page: number) => loadCustomers(page, pagination.limit),
  };
}
