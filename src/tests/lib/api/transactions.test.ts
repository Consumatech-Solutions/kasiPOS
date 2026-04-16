import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toCreateTransactionDto, transactionsApi } from '@/lib/api/transactions';

vi.mock('@/lib/api/core', () => ({
  api: {
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import { api } from '@/lib/api/core';

describe('toCreateTransactionDto', () => {
  it('stringifies storeId and product ids and coerces numeric fields', () => {
    const dto = toCreateTransactionDto({
      storeId: 99 as unknown as string,
      items: [
        {
          productId: 1 as unknown as string,
          productName: 'A',
          quantity: 2 as unknown as number,
          unitPrice: '10.5' as unknown as number,
          totalPrice: '21' as unknown as number,
        },
      ],
      total: 21,
      paymentMethod: 'Cash',
    });
    expect(dto.storeId).toBe('99');
    expect(dto.items[0].productId).toBe('1');
    expect(dto.items[0].quantity).toBe(2);
    expect(dto.items[0].unitPrice).toBe(10.5);
    expect(dto.items[0].totalPrice).toBe(21);
  });

  it('includes voucherCode when non-empty and omits empty discount', () => {
    const dto = toCreateTransactionDto({
      storeId: 's',
      items: [
        {
          productId: 'p',
          productName: 'A',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
      total: 1,
      paymentMethod: 'Cash',
      voucherCode: 'SAVE10',
      discount: {
        discountType: 'amount',
        discountAmount: 1,
        discountReason: '   ',
      },
    });
    expect(dto.voucherCode).toBe('SAVE10');
    expect(dto.discount).toBeUndefined();
  });

  it('includes discount when discountReason is non-empty', () => {
    const dto = toCreateTransactionDto({
      storeId: 's',
      items: [
        {
          productId: 'p',
          productName: 'A',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
      total: 1,
      paymentMethod: 'Cash',
      discount: {
        discountType: 'amount',
        discountAmount: 2,
        discountReason: ' Promo ',
      },
    });
    expect(dto.discount).toEqual({
      discountType: 'amount',
      discountAmount: 2,
      discountReason: 'Promo',
    });
  });

  it('adds creditDetails for Credit payment when provided', () => {
    const dto = toCreateTransactionDto({
      storeId: 's',
      items: [
        {
          productId: 'p',
          productName: 'A',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
      total: 1,
      paymentMethod: 'Credit',
      creditDetails: {
        paymentDate: '2024-01-01',
        note: '  note  ',
      },
    });
    expect(dto.creditDetails).toEqual({
      paymentDate: '2024-01-01',
      note: 'note',
    });
  });
});

describe('transactionsApi.create', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockClear();
  });

  it('POSTs to /transactions with body', async () => {
    const body = toCreateTransactionDto({
      storeId: 's',
      items: [
        {
          productId: 'p',
          productName: 'A',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
      total: 1,
      paymentMethod: 'Cash',
    });
    await transactionsApi.create(body);
    expect(api.post).toHaveBeenCalledWith('/transactions', body, undefined);
  });

  it('sends Idempotency-Key header when idempotencyKey is provided', async () => {
    const body = toCreateTransactionDto({
      storeId: 's',
      items: [
        {
          productId: 'p',
          productName: 'A',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
      total: 1,
      paymentMethod: 'Cash',
    });
    const idem = '550e8400-e29b-41d4-a716-446655440000';
    await transactionsApi.create(body, { idempotencyKey: idem });
    expect(api.post).toHaveBeenCalledWith('/transactions', body, {
      headers: { 'Idempotency-Key': idem },
    });
  });
});
