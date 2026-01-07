import Dexie, { type Table } from 'dexie';
import type { Product, Customer, Transaction, Voucher, Category } from '@/types';

export class KasiPosDexie extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  transactions!: Table<Transaction>;
  vouchers!: Table<Voucher>;
  categories!: Table<Category>;

  constructor() {
    super('kasiPosDatabase');
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
