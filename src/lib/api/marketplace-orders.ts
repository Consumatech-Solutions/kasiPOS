import { api } from './core';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export type MarketplaceOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
};

export type MarketplaceOrder = {
  id: string;
  orderCode: string;
  marketplaceStoreId: string;
  storeId: string;
  customerId?: string | null;
  items: MarketplaceOrderItem[];
  subtotal: number;
  vatAmount: number;
  serviceFee: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type CreateMarketplaceOrderItemDto = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
};

export type CreateMarketplaceOrderDto = {
  marketplaceStoreId: string;
  storeId: string;
  customerId?: string;
  items: CreateMarketplaceOrderItemDto[];
  subtotal: number;
  vatAmount?: number;
  serviceFee?: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
};

export interface GetMarketplaceOrdersParams extends PaginationParams {
  marketplaceStoreId?: string;
  customerId?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  search?: string; // Search by order code
}

export const marketplaceOrdersApi = {
  create: (data: CreateMarketplaceOrderDto) => {
    return api.post<MarketplaceOrder>('/marketplace-orders', data);
  },

  /**
   * Get all marketplace orders with pagination and filters
   */
  getAll: (params?: GetMarketplaceOrdersParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.marketplaceStoreId !== undefined) {
      requestParams.marketplaceStoreId = params.marketplaceStoreId;
    }
    if (params?.customerId !== undefined) {
      requestParams.customerId = params.customerId;
    }
    if (params?.status !== undefined) {
      requestParams.status = params.status;
    }
    if (params?.search !== undefined) {
      requestParams.search = params.search;
    }

    return api.get<PaginatedResponse<MarketplaceOrder> | MarketplaceOrder[]>('/marketplace-orders', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  /**
   * Search for an order by order code
   */
  findByOrderCode: (code: string) => {
    return api.get<MarketplaceOrder>('/marketplace-orders/search', {
      params: { code },
    });
  },

  /**
   * Get a marketplace order by ID
   */
  getById: (id: string) => {
    return api.get<MarketplaceOrder>(`/marketplace-orders/${id}`);
  },

  /**
   * Update marketplace order status
   */
  updateStatus: (id: string, status: 'pending' | 'completed' | 'cancelled') => {
    return api.patch<MarketplaceOrder>(`/marketplace-orders/${id}/status`, { status });
  },
};
