import { api } from "./core";
import type { Voucher } from "@/types";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

export interface CreateVoucherDto {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minPurchase: number;
  isActive?: boolean;
  expiresAt?: string;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
}

export interface UpdateVoucherDto {
  code?: string;
  type?: "percentage" | "fixed";
  value?: number;
  minPurchase?: number;
  isActive?: boolean;
  expiresAt?: string | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
}

export interface GetVouchersParams extends PaginationParams {
  isActive?: boolean;
}

export interface ValidateVoucherDto {
  code: string;
  cartTotal: number;
  customerId?: string;
}

export interface ValidateVoucherResponse {
  valid: boolean;
  voucher?: {
    id: string;
    code: string;
    type: string;
    value: number;
  };
  discountAmount?: number;
  message?: string;
}

export const vouchersApi = {
  create: (data: CreateVoucherDto) => {
    return api.post<Voucher>("/vouchers", data);
  },

  getAll: (params?: GetVouchersParams) => {
    const requestParams: Record<string, number | string | boolean> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.isActive !== undefined) {
      requestParams.isActive = params.isActive;
    }

    return api.get<PaginatedResponse<Voucher> | Voucher[]>("/vouchers", {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  getById: (id: string) => {
    return api.get<Voucher>(`/vouchers/${id}`);
  },

  update: (id: string, data: UpdateVoucherDto) => {
    return api.patch<Voucher>(`/vouchers/${id}`, data);
  },

  delete: (id: string) => {
    return api.delete(`/vouchers/${id}`);
  },

  validate: (data: ValidateVoucherDto) => {
    return api.post<ValidateVoucherResponse>("/vouchers/validate", data);
  },
};
