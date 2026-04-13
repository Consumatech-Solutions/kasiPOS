import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cartFromStorage,
  cartToStorage,
  CART_STORAGE_KEY,
  loadCartFromSessionStorageAsync,
  saveCartToSessionStorage,
} from '@/lib/cart-storage';
import { getDb, resetDbInstanceForTests } from '@/lib/db';
import type { TransactionItem } from '@/types';

function sampleItem(overrides: Partial<TransactionItem> = {}): TransactionItem {
  return {
    productId: 'p1',
    productName: 'Item',
    quantity: 1,
    unitPrice: 10,
    totalPrice: 10,
    ...overrides,
  };
}

describe('cart-storage', () => {
  beforeEach(async () => {
    await resetDbInstanceForTests();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('cartToStorage', () => {
    it('serializes cart entries and omits blob image URLs', () => {
      const cart = new Map<string, TransactionItem>([
        [
          'p1',
          sampleItem({
            imageUrl: 'blob:http://localhost/abc',
            stock: 5,
          }),
        ],
      ]);
      const raw = cartToStorage(cart);
      const parsed = JSON.parse(raw) as [string, TransactionItem][];
      expect(parsed[0][1].imageUrl).toBeUndefined();
      expect(parsed[0][1].quantity).toBe(1);
      expect(parsed[0][1].unitPrice).toBe(10);
    });

    it('keeps non-blob imageUrl', () => {
      const cart = new Map([['p1', sampleItem({ imageUrl: 'https://cdn.example/x.png' })]]);
      const parsed = JSON.parse(cartToStorage(cart)) as [string, TransactionItem][];
      expect(parsed[0][1].imageUrl).toBe('https://cdn.example/x.png');
    });
  });

  describe('cartFromStorage', () => {
    it('returns empty map for null or invalid JSON', () => {
      expect(cartFromStorage(null).size).toBe(0);
      expect(cartFromStorage('').size).toBe(0);
      expect(cartFromStorage('not-json').size).toBe(0);
    });

    it('skips entries missing quantity, unitPrice, or totalPrice', () => {
      const raw = JSON.stringify([
        ['bad', { productName: 'x' }],
        ['good', sampleItem({ productId: 'good' })],
      ]);
      const map = cartFromStorage(raw);
      expect(map.size).toBe(1);
      expect(map.has('good')).toBe(true);
    });

    it('strips blob imageUrl on load', () => {
      const raw = JSON.stringify([['p1', sampleItem({ imageUrl: 'blob:http://x/y' })]]);
      const map = cartFromStorage(raw);
      expect(map.get('p1')?.imageUrl).toBeUndefined();
    });
  });

  describe('Dexie and storage fallbacks', () => {
    it('loadCartFromSessionStorageAsync reads from keyVal first', async () => {
      const cart = new Map([['a', sampleItem({ productId: 'a', quantity: 2, totalPrice: 20 })]]);
      const db = getDb();
      await db.open();
      await db.keyVal.put({ key: CART_STORAGE_KEY, value: cartToStorage(cart) });
      const loaded = await loadCartFromSessionStorageAsync();
      expect(loaded.get('a')?.quantity).toBe(2);
    });

    it('falls back to localStorage when keyVal has no cart', async () => {
      const cart = new Map([['b', sampleItem({ productId: 'b' })]]);
      window.localStorage.setItem(CART_STORAGE_KEY, cartToStorage(cart));
      const loaded = await loadCartFromSessionStorageAsync();
      expect(loaded.get('b')?.productName).toBe('Item');
    });

    it('saveCartToSessionStorage writes to Dexie keyVal', async () => {
      const db = getDb();
      await db.open();
      const cart = new Map([['c', sampleItem({ productId: 'c' })]]);
      saveCartToSessionStorage(cart);
      await waitFor(async () => {
        const row = await db.keyVal.get(CART_STORAGE_KEY);
        expect(row?.value).toContain('c');
      });
    });
  });
});
