import Dexie, { type Table } from 'dexie';
import type { Product, Customer, Transaction, Voucher, Category, StockAdjustment, Parcel, PurchaseOrder } from '@/types';

export class KasiPosDexie extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  transactions!: Table<Transaction>;
  vouchers!: Table<Voucher>;
  categories!: Table<Category>;
  stockAdjustments!: Table<StockAdjustment>;
  parcels!: Table<Parcel>;
  purchaseOrders!: Table<PurchaseOrder>;

  constructor() {
    super('kasiPosDatabase');
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
    }).upgrade(tx => {
      // Seed initial categories if the table is new
      return tx.table('categories').bulkAdd([
        { name: 'Drinks' },
        { name: 'Snacks' },
        { name: 'Bakery' },
        { name: 'Dairy' },
        { name: 'Confectionery' },
        { name: 'Groceries' },
        { name: 'Beverages' },
        { name: 'Toiletries' },
        { name: 'Airtime' },
        { name: 'Cigs' },
        { name: 'Veg' },
      ]);
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
