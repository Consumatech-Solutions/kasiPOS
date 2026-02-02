import type { TransactionItem } from '@/types';
import type { ReceiptData } from '@/components/pos/ReceiptModal';

const VAT_RATE = 15;

/**
 * Build receipt data from transaction details.
 * Used for receipt display and for tests to ensure content accuracy.
 */
export function buildReceiptData(params: {
  storeName: string;
  saleId: string;
  items: TransactionItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  showVat: boolean;
  voucherCode?: string | null;
  timestamp?: Date;
}): ReceiptData {
  const vatAmount = params.total * (VAT_RATE / (100 + VAT_RATE));
  return {
    storeName: params.storeName,
    saleId: params.saleId,
    timestamp: params.timestamp ?? new Date(),
    items: params.items,
    subtotal: params.subtotal,
    discountAmount: params.discountAmount,
    showVat: params.showVat,
    vatAmount,
    total: params.total,
    paymentMethod: params.paymentMethod,
    voucherCode: params.voucherCode ?? null,
  };
}

/**
 * Validate receipt content accuracy (items, quantities, totals, VAT, payment method, timestamp, sale ID).
 * Returns an array of error messages; empty array means valid.
 */
export function validateReceiptContent(data: ReceiptData): string[] {
  const errors: string[] = [];

  if (!data.storeName?.trim()) errors.push('Store name is missing');
  if (!data.saleId?.trim()) errors.push('Sale ID is missing');
  if (!(data.timestamp instanceof Date) && !data.timestamp) errors.push('Timestamp is missing');
  if (!Array.isArray(data.items) || data.items.length === 0) errors.push('Items are missing or empty');

  const itemsSubtotal = data.items.reduce((sum, item) => sum + (item.totalPrice ?? item.unitPrice * item.quantity), 0);
  const roundedItemsSubtotal = Math.round(itemsSubtotal * 100) / 100;
  // When showVat: subtotal is ex-VAT, items total = subtotal + discount (cart before discount)
  const expectedItemsTotal = data.showVat
    ? Math.round((data.subtotal + data.discountAmount) * 100) / 100
    : Math.round(data.subtotal * 100) / 100;
  if (Math.abs(roundedItemsSubtotal - expectedItemsTotal) > 0.02) {
    errors.push(`Items total ${roundedItemsSubtotal} does not match ${data.showVat ? 'subtotal + discount' : 'subtotal'} (${expectedItemsTotal})`);
  }

  const expectedTotal = data.showVat
    ? data.subtotal + data.vatAmount
    : data.subtotal - data.discountAmount;
  if (Math.abs(data.total - expectedTotal) > 0.02) {
    errors.push(
      data.showVat
        ? `Total ${data.total} does not match subtotal + VAT (${expectedTotal})`
        : `Total ${data.total} does not match subtotal - discount (${expectedTotal})`
    );
  }

  if (data.showVat) {
    const expectedVat = data.total * (VAT_RATE / (100 + VAT_RATE));
    if (Math.abs(data.vatAmount - expectedVat) > 0.02) {
      errors.push(`VAT amount ${data.vatAmount.toFixed(2)} does not match expected ${expectedVat.toFixed(2)}`);
    }
  }

  const validMethods = ['Cash', 'Card', 'Mobile Money'];
  if (!validMethods.includes(data.paymentMethod)) {
    errors.push(`Invalid payment method: ${data.paymentMethod}`);
  }

  data.items.forEach((item, i) => {
    if (!item.productName?.trim()) errors.push(`Item ${i + 1}: product name missing`);
    if (item.quantity <= 0) errors.push(`Item ${i + 1}: quantity must be positive`);
    const lineTotal = (item.unitPrice ?? 0) * item.quantity;
    const expectedLineTotal = item.totalPrice ?? lineTotal;
    if (Math.abs(lineTotal - expectedLineTotal) > 0.02) {
      errors.push(`Item ${i + 1}: quantity * unitPrice does not match totalPrice`);
    }
  });

  return errors;
}
