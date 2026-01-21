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

export class KasiPosDexie extends Dexie {
  stores!: Table<Store>;
  products!: Table<Product>;
  customers!: Table<Customer>;
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
      const defaultStore = {
          name: 'My Store',
          isSetupComplete: true, // Assume existing users have completed setup
          receiptHeader: 'Thank you for your purchase!',
          receiptFooter: 'Find us on social media @KasiPOS',
      };
      const storeId = await tx.table('stores').add(defaultStore);

      // Now, associate all existing data with this new default store.
      const tablesToMigrate = [
          'products', 'customers', 'transactions', 'vouchers', 
          'categories', 'stockAdjustments', 'parcels', 'purchaseOrders', 'users'
      ];

      for (const tableName of tablesToMigrate) {
          const table = tx.table(tableName);
          // Only attempt to modify if the table exists in the transaction
          if (table) {
              await table.toCollection().modify({ storeId });
          }
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
