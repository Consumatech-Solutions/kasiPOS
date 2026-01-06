import Dexie, { type Table } from 'dexie';
import type { Product, Customer, Transaction, Voucher } from '@/types';

export class KasiPosDexie extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  transactions!: Table<Transaction>;
  vouchers!: Table<Voucher>;

  constructor() {
    super('kasiPosDatabase');
    this.version(1).stores({
      products: '++id, name, category, barcode',
      customers: '++id, name, email',
      transactions: '++id, customerId, date',
      vouchers: '++id, code, isActive',
    });
  }
}

export const db = new KasiPosDexie();
