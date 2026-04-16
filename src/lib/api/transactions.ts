/**
 * Transactions API – aligned with backend spec:
 *
 * POST   /transactions        Create a transaction (sale). Body: application/json. 201 = created.
 * GET    /transactions        List transactions. Query: page (default 1), limit (default 10, max 100), date (ISO), customerId (UUID), search (transaction ID). 200 = ok, 401 = unauthorized.
 * GET    /transactions/{id}   Get transaction by ID (UUID). 200 = ok, 401 = unauthorized, 404 = not found.
 */
import { api } from './core';
import type { Transaction, TransactionDiscount, TransactionCreditDetails } from '@/types';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export type CreateTransactionItemDto = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
};

export type CreateTransactionDto = {
  /** Store ID: UUID string from backend. */
  storeId: string;
  customerId?: string;
  items: CreateTransactionItemDto[];
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Credit';
  voucherCode?: string;
  /** @deprecated Prefer discount object. */
  discountAmount?: number;
  /** Structured discount (manual apply discount). Optional. */
  discount?: TransactionDiscount;
  /** Required when paymentMethod is 'Credit'. */
  creditDetails?: TransactionCreditDetails;
};

export interface GetTransactionsParams extends PaginationParams {
  /** Page number (default 1) */
  page?: number;
  /** Items per page (default 10, max 100) */
  limit?: number;
  /** Filter by date (ISO date string, e.g. 2024-01-15) */
  date?: string;
  /** Filter by customer ID (UUID) */
  customerId?: string;
  /** Search by transaction ID */
  search?: string;
}

/** Normalize transaction-like data into CreateTransactionDto (storeId as UUID string, productId string, no extra fields). */
export function toCreateTransactionDto(raw: {
  storeId: string | number;
  customerId?: string | null;
  items: Array<{ productId: string | number; productName: string; quantity: number; unitPrice: number; totalPrice: number; imageUrl?: string; [k: string]: unknown }>;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Credit';
  voucherCode?: string | null;
  discountAmount?: number | null;
  discount?: TransactionDiscount | null;
  creditDetails?: TransactionCreditDetails | null;
}): CreateTransactionDto {
  const storeId = raw.storeId != null && raw.storeId !== '' ? String(raw.storeId) : '';
  const dto: CreateTransactionDto = {
    storeId,
    customerId: raw.customerId ?? undefined,
    items: raw.items.map((item) => ({
      productId: String(item.productId),
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      ...(item.imageUrl != null && item.imageUrl !== '' && { imageUrl: item.imageUrl }),
    })),
    total: Number(raw.total),
    paymentMethod: raw.paymentMethod,
    ...(raw.voucherCode != null && raw.voucherCode !== '' && { voucherCode: raw.voucherCode }),
  };
  if (raw.discount != null && raw.discount.discountReason != null && raw.discount.discountReason.trim() !== '') {
    dto.discount = {
      discountType: raw.discount.discountType,
      discountAmount: Number(raw.discount.discountAmount),
      discountReason: String(raw.discount.discountReason).trim(),
    };
  }
  if (raw.paymentMethod === 'Credit' && raw.creditDetails != null) {
    dto.creditDetails = {};
    if (raw.creditDetails.paymentDate != null && raw.creditDetails.paymentDate !== '') {
      dto.creditDetails.paymentDate = raw.creditDetails.paymentDate;
    }
    if (raw.creditDetails.note != null && raw.creditDetails.note.trim() !== '') {
      dto.creditDetails.note = raw.creditDetails.note.trim();
    }
  }
  return dto;
}

export const transactionsApi = {
  create: (data: CreateTransactionDto, options?: { idempotencyKey?: string }) => {
    const headers =
      options?.idempotencyKey != null && options.idempotencyKey !== ''
        ? { 'Idempotency-Key': options.idempotencyKey }
        : undefined;
    return api.post<Transaction>('/transactions', data, headers ? { headers } : undefined);
  },

  /**
   * Get all transactions with pagination and filters
   */
  getAll: (params?: GetTransactionsParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) requestParams.page = params.page;
    if (params?.limit !== undefined) requestParams.limit = Math.min(100, params.limit);
    if (params?.date !== undefined) requestParams.date = params.date;
    if (params?.customerId !== undefined) requestParams.customerId = params.customerId;
    if (params?.search !== undefined) requestParams.search = params.search;
    if (params?.storeId != null && params.storeId !== '') requestParams.storeId = params.storeId;

    return api.get<PaginatedResponse<Transaction> | Transaction[]>('/transactions', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  getById: (id: string, params?: { storeId?: string | null }) => {
    const requestParams: Record<string, string> = {};
    if (params?.storeId != null && params.storeId !== '') requestParams.storeId = params.storeId;
    return api.get<Transaction>(`/transactions/${id}`, {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },
};

