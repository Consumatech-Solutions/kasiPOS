import { api } from './core';
import type { Transaction } from '@/types';
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
  storeId: number;
  customerId?: string;
  items: CreateTransactionItemDto[];
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  voucherCode?: string;
  discountAmount?: number;
};

export interface GetTransactionsParams extends PaginationParams {
  date?: string; // ISO date string (YYYY-MM-DD)
  customerId?: string;
  search?: string; // Search by transaction ID
}

export const transactionsApi = {
  create: (data: CreateTransactionDto) => {
    return api.post<Transaction>('/transactions', data);
  },

  /**
   * Get all transactions with pagination and filters
   */
  getAll: (params?: GetTransactionsParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.date !== undefined) {
      requestParams.date = params.date;
    }
    if (params?.customerId !== undefined) {
      requestParams.customerId = params.customerId;
    }
    if (params?.search !== undefined) {
      requestParams.search = params.search;
    }

    return api.get<PaginatedResponse<Transaction> | Transaction[]>('/transactions', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  /**
   * Get a transaction by ID
   */
  getById: (id: string) => {
    return api.get<Transaction>(`/transactions/${id}`);
  },
};

