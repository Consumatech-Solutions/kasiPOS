import { api } from './core';
import type { StockAdjustment, StockAdjustmentReason } from '@/types';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export interface CreateStockAdjustmentDto {
  productId: string;
  newStock: number;
  reason: StockAdjustmentReason;
  note?: string;
}

export interface GetStockAdjustmentsParams extends PaginationParams {
  productId?: string;
}

export const stockAdjustmentsApi = {
  /**
   * Create a stock adjustment
   */
  create: (data: CreateStockAdjustmentDto) => {
    return api.post<StockAdjustment>('/stock-adjustments', data);
  },

  /**
   * Get all stock adjustments with pagination
   */
  getAll: (params?: GetStockAdjustmentsParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.productId !== undefined) {
      requestParams.productId = params.productId;
    }

    return api.get<PaginatedResponse<StockAdjustment> | StockAdjustment[]>('/stock-adjustments', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  /**
   * Get stock adjustments for a specific product
   */
  getByProduct: (productId: string) => {
    return api.get<StockAdjustment[]>(`/stock-adjustments/product/${productId}`);
  },
};
