import Dexie, { type Table } from 'dexie';
import type { Product, Customer, Transaction, Voucher, Category, StockAdjustment, Parcel, PurchaseOrder, User, Store } from '@/types';

export interface ProductImageRecord {
  id: string;
  productId: string; // Toujours stocké comme string pour éviter les problèmes de type avec IndexedDB
  imageData: Blob;
  mimeType: string;
  size: number;
  synced: boolean;
  serverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Interfaces pour les enregistrements IndexedDB avec synchronisation
export interface CustomerRecord extends Customer {
  synced?: boolean;
  lastSyncedAt?: string;
}

export interface StoreRecord extends Store {
  synced?: boolean;
  lastSyncedAt?: string;
}

export class KasiPosDexie extends Dexie {
  stores!: Table<StoreRecord>;
  products!: Table<Product>;
  customers!: Table<CustomerRecord>;
  transactions!: Table<Transaction>;
  vouchers!: Table<Voucher>;
  categories!: Table<Category>;
  stockAdjustments!: Table<StockAdjustment>;
  parcels!: Table<Parcel>;
  purchaseOrders!: Table<PurchaseOrder>;
  users!: Table<User>;
  productImages!: Table<ProductImageRecord>;

  constructor() {
    super('kasiPosDatabase');
    this.version(12).stores({
      stores: '++id, name, ownerId',
      products: '++id, name, category, barcode, storeId',
      customers: 'id, name, contact, synced, lastSyncedAt, storeId',
      transactions: '++id, customerId, date, storeId',
      vouchers: '++id, code, isActive, storeId',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date, storeId',
      parcels: '++id, deliveryNumber, collectionCode, status, storeId',
      purchaseOrders: '++id, orderCode, date, storeId',
      users: '++id, &phone, role, storeId',
      productImages: 'id, productId, synced, createdAt',
    });
    this.version(11).stores({
      stores: '++id, name, ownerId',
      products: '++id, name, category, barcode, storeId',
      customers: 'id, name, contact, synced, lastSyncedAt',
      transactions: '++id, customerId, date, storeId',
      vouchers: '++id, code, isActive, storeId',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date, storeId',
      parcels: '++id, deliveryNumber, collectionCode, status, storeId',
      purchaseOrders: '++id, orderCode, date, storeId',
      users: '++id, &phone, role, storeId',
      productImages: 'id, productId, synced, createdAt',
    });
    this.version(10).stores({
      stores: '++id, name, ownerId',
      products: '++id, name, category, barcode, storeId',
      // customers supprimé explicitement pour permettre le changement de clé primaire dans la version 11
      transactions: '++id, customerId, date, storeId',
      vouchers: '++id, code, isActive, storeId',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date, storeId',
      parcels: '++id, deliveryNumber, collectionCode, status, storeId',
      purchaseOrders: '++id, orderCode, date, storeId',
      users: '++id, &phone, role, storeId',
      productImages: 'id, productId, synced, createdAt',
    }).upgrade(async tx => {
      // Supprimer explicitement la table customers pour permettre le changement de clé primaire
      // Dexie supprimera automatiquement la table si elle n'est pas dans la définition des stores
      try {
        const customersTable = tx.table('customers');
        await customersTable.clear();
        console.log('Version 10: Cleared customers table to prepare for primary key change');
      } catch (error) {
        // La table pourrait ne pas exister, ce qui est OK
        console.log('Version 10: Customers table already removed or does not exist');
      }
    });
    this.version(9).stores({
      stores: '++id, name',
      products: '++id, name, category, barcode, storeId',
      customers: '++id, name, phone, storeId',
      transactions: '++id, customerId, date, storeId',
      vouchers: '++id, code, isActive, storeId',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date, storeId',
      parcels: '++id, deliveryNumber, collectionCode, status, storeId',
      purchaseOrders: '++id, orderCode, date, storeId',
      users: '++id, &phone, role, storeId',
      productImages: 'id, productId, synced, createdAt',
    }).upgrade(async tx => {
      // This migration is for users who have existing data from before multi-tenancy was introduced.
      // We create a default store for all their existing data.

      // Note: Stores and customers are now managed via API only, but we keep this migration for backward compatibility
      try {
        const storesTable = tx.table('stores');
        const existingStores = await storesTable.toArray();
        
        let storeId;
        // Only create default store if none exists
        if (existingStores.length === 0) {
          const defaultStore = {
              name: 'My Store',
              isSetupComplete: true, // Assume existing users have completed setup
              receiptHeader: 'Thank you for your purchase!',
              receiptFooter: 'Find us on social media @KasiPOS',
          };
          storeId = await storesTable.add(defaultStore);
        } else {
          // Use existing store ID
          storeId = existingStores[0].id;
        }

        // Now, associate all existing data with this new default store.
        // Note: Customers are now managed via API only, so we skip customer migration
        const tablesToMigrate = [
            'products', 'transactions', 'vouchers', 
            'categories', 'stockAdjustments', 'parcels', 'purchaseOrders', 'users'
        ];

        for (const tableName of tablesToMigrate) {
            const table = tx.table(tableName);
            // Only attempt to modify if the table exists in the transaction
            if (table) {
                try {
                  await table.toCollection().modify({ storeId });
                } catch (error) {
                  // Ignore errors for individual table migrations
                  console.warn(`Migration skipped for ${tableName}:`, error);
                }
            }
        }
      } catch (error) {
        // Ignore errors - stores are now managed via API
        console.warn('Store migration skipped (stores now managed via API):', error);

      }
    });
    this.version(7).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, phone',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date',
      parcels: '++id, deliveryNumber, collectionCode, status',
      purchaseOrders: '++id, orderCode, date',
      users: '++id, &phone, role',
    });
    this.version(6).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, phone',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date',
      parcels: '++id, deliveryNumber, collectionCode, status',
      purchaseOrders: '++id, orderCode, date',
    });
    this.version(5).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, phone',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date',
      parcels: '++id, deliveryNumber, collectionCode, status',
    });
    this.version(4).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, phone',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date',
    });
    this.version(3).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, email',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
      stockAdjustments: '++id, productId, date',
    }).upgrade(tx => {
      // New version 4 will handle the schema change from email to phone
    });
    this.version(2).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, email',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
      categories: '++id, name',
    });
    this.version(1).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, email',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
    });
  }
}

// Instance singleton de la base de données
let dbInstance: KasiPosDexie | null = null;

/**
 * Obtient l'instance de la base de données.
 * Ne peut être appelé que côté client (dans le navigateur).
 * 
 * @throws {Error} Si appelé côté serveur
 */
export function getDb(): KasiPosDexie {
  // Vérifier que nous sommes côté client
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed on the client side');
  }

  if (!dbInstance) {
    dbInstance = new KasiPosDexie();
  }

  return dbInstance;
}

// Export pour compatibilité avec le code existant
// Utilise getDb() pour éviter les problèmes SSR
export const db = typeof window !== 'undefined' ? getDb() : (null as any);
