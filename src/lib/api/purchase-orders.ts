import { api } from "./core";
import type { PurchaseOrder } from "@/types";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

export interface CreatePurchaseOrderDto {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    groupPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryMethod: "delivery" | "collection";
}

export interface UpdatePurchaseOrderDto {
  status?: "pending" | "completed" | "cancelled";
}

export interface GetPurchaseOrdersParams extends PaginationParams {
  // add filters here
}

export const purchaseOrdersApi = {
  create: (data: CreatePurchaseOrderDto) => {
    return api.post<PurchaseOrder>("/purchase-orders", data);
  },

  getAll: (params?: GetPurchaseOrdersParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }

    return api.get<PaginatedResponse<PurchaseOrder> | PurchaseOrder[]>(
      "/purchase-orders",
      {
        params:
          Object.keys(requestParams).length > 0 ? requestParams : undefined,
      }
    );
  },

  getById: (id: string) => {
    return api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  },

  updateStatus: (id: string, data: UpdatePurchaseOrderDto) => {
    return api.patch<PurchaseOrder>(`/purchase-orders/${id}`, data);
  },
};
