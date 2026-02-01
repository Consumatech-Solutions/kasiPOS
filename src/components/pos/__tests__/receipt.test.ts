import { describe, it, expect } from 'vitest';
import { buildReceiptData, validateReceiptContent } from '@/lib/receipt-utils';
import type { TransactionItem } from '@/types';

const sampleItems: TransactionItem[] = [
  { productId: 'p1', productName: 'Product A', quantity: 2, unitPrice: 10, totalPrice: 20 },
  { productId: 'p2', productName: 'Product B', quantity: 1, unitPrice: 78, totalPrice: 78 },
];

describe('Receipt generation and content accuracy', () => {
  it('builds receipt with correct items, quantities, and totals', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-123',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Cash',
      showVat: false,
    });
    expect(data.items).toHaveLength(2);
    expect(data.items[0].productName).toBe('Product A');
    expect(data.items[0].quantity).toBe(2);
    expect(data.items[0].totalPrice).toBe(20);
    expect(data.subtotal).toBe(98);
    expect(data.total).toBe(98);
    expect(data.saleId).toBe('TXN-123');
    expect(data.paymentMethod).toBe('Cash');
    expect(data.timestamp).toBeInstanceOf(Date);
  });

  it('includes VAT amount when showVat is true', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-456',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Card',
      showVat: true,
    });
    expect(data.showVat).toBe(true);
    const expectedVat = 98 * (15 / 115);
    expect(Math.abs(data.vatAmount - expectedVat)).toBeLessThan(0.02);
  });

  it('omits VAT amount when showVat is false', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-789',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Mobile Money',
      showVat: false,
    });
    expect(data.showVat).toBe(false);
    expect(data.vatAmount).toBeGreaterThanOrEqual(0);
  });

  it('includes discount and voucher code when present', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-999',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 10,
      total: 88,
      paymentMethod: 'Cash',
      showVat: false,
      voucherCode: 'SAVE10',
    });
    expect(data.discountAmount).toBe(10);
    expect(data.voucherCode).toBe('SAVE10');
    expect(data.total).toBe(88);
  });

  it('validateReceiptContent passes for valid receipt', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-1',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Cash',
      showVat: false,
    });
    const errors = validateReceiptContent(data);
    expect(errors).toHaveLength(0);
  });

  it('validateReceiptContent fails when items total does not match subtotal', () => {
    const badData = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-1',
      items: sampleItems,
      subtotal: 99,
      discountAmount: 0,
      total: 99,
      paymentMethod: 'Cash',
      showVat: false,
    });
    const errors = validateReceiptContent(badData);
    expect(errors.some((e) => e.includes('subtotal'))).toBe(true);
  });

  it('validateReceiptContent fails when payment method is invalid', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-1',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Cash',
      showVat: false,
    });
    const invalidData = { ...data, paymentMethod: 'Invalid' as any };
    const errors = validateReceiptContent(invalidData);
    expect(errors.some((e) => e.includes('payment method'))).toBe(true);
  });

  it('timestamp is set and is a valid Date', () => {
    const data = buildReceiptData({
      storeName: 'Test Store',
      saleId: 'TXN-1',
      items: sampleItems,
      subtotal: 98,
      discountAmount: 0,
      total: 98,
      paymentMethod: 'Cash',
      showVat: false,
    });
    expect(data.timestamp).toBeInstanceOf(Date);
    expect(Number.isNaN(data.timestamp.getTime())).toBe(false);
  });
});
