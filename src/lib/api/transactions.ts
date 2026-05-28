import { api } from "./core";
import type {
  Transaction,
  TransactionDiscount,
  TransactionCreditDetails,
} from "@/types";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

export type CreateTransactionItemDto = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
};

export type CreateTransactionDto = {
  storeId: string;
  customerId?: string;
  items: CreateTransactionItemDto[];
  total: number;
  paymentMethod: "Cash" | "Card" | "Mobile Money" | "Credit";
  voucherCode?: string;
  discountAmount?: number;
  discount?: TransactionDiscount;
  creditDetails?: TransactionCreditDetails;
};

/** Body for POST /transactions/clear-credit (mark pending credit as paid). */
export type ClearCreditRequest = { id: string };

export interface GetTransactionsParams extends PaginationParams {
  page?: number;
  limit?: number;
  date?: string;
  customerId?: string;
  search?: string;
}

export function toCreateTransactionDto(raw: {
  storeId: string | number;
  customerId?: string | null;
  items: Array<{
    productId: string | number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
    [k: string]: unknown;
  }>;
  total: number;
  paymentMethod: "Cash" | "Card" | "Mobile Money" | "Credit";
  voucherCode?: string | null;
  discountAmount?: number | null;
  discount?: TransactionDiscount | null;
  creditDetails?: TransactionCreditDetails | null;
}): CreateTransactionDto {
  const storeId =
    raw.storeId != null && raw.storeId !== "" ? String(raw.storeId) : "";
  const dto: CreateTransactionDto = {
    storeId,
    customerId: raw.customerId ?? undefined,
    items: raw.items.map((item) => ({
      productId: String(item.productId),
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      ...(item.imageUrl != null &&
        item.imageUrl !== "" && { imageUrl: item.imageUrl }),
    })),
    total: Number(raw.total),
    paymentMethod: raw.paymentMethod,
    ...(raw.voucherCode != null &&
      raw.voucherCode !== "" && { voucherCode: raw.voucherCode }),
  };
  if (
    raw.discount != null &&
    raw.discount.discountReason != null &&
    raw.discount.discountReason.trim() !== ""
  ) {
    dto.discount = {
      discountType: raw.discount.discountType,
      discountAmount: Number(raw.discount.discountAmount),
      discountReason: String(raw.discount.discountReason).trim(),
    };
  }
  if (raw.paymentMethod === "Credit" && raw.creditDetails != null) {
    dto.creditDetails = {};
    if (
      raw.creditDetails.paymentDate != null &&
      raw.creditDetails.paymentDate !== ""
    ) {
      dto.creditDetails.paymentDate = raw.creditDetails.paymentDate;
    }
    if (
      raw.creditDetails.note != null &&
      raw.creditDetails.note.trim() !== ""
    ) {
      dto.creditDetails.note = raw.creditDetails.note.trim();
    }
  }
  return dto;
}

export const transactionsApi = {
  create: (
    data: CreateTransactionDto,
    options?: { idempotencyKey?: string }
  ) => {
    const headers =
      options?.idempotencyKey != null && options.idempotencyKey !== ""
        ? { "Idempotency-Key": options.idempotencyKey }
        : undefined;
    return api.post<Transaction>(
      "/transactions",
      data,
      headers ? { headers } : undefined
    );
  },

  getAll: (params?: GetTransactionsParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) requestParams.page = params.page;
    if (params?.limit !== undefined)
      requestParams.limit = Math.min(100, params.limit);
    if (params?.date !== undefined) requestParams.date = params.date;
    if (params?.customerId !== undefined)
      requestParams.customerId = params.customerId;
    if (params?.search !== undefined) requestParams.search = params.search;
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;

    return api.get<PaginatedResponse<Transaction> | Transaction[]>(
      "/transactions",
      {
        params:
          Object.keys(requestParams).length > 0 ? requestParams : undefined,
      }
    );
  },

  clearCredit: (data: ClearCreditRequest) =>
    api.post<Transaction>("/transactions/clear-credit", data),

  getById: (id: string, params?: { storeId?: string | null }) => {
    const requestParams: Record<string, string> = {};
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;
    return api.get<Transaction>(`/transactions/${id}`, {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },
};
