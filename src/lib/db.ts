import Dexie, { type Table } from 'dexie';
import type { Product, Customer, Transaction, Voucher, Category, StockAdjustment, Parcel, PurchaseOrder, User, Store } from '@/types';

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

  constructor() {
    super('kasiPosDatabase');
    this.version(8).stores({
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

export const db = new KasiPosDexie();
