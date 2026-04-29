import { api } from "./core";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "@/types";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

export const customersApi = {
  getAll: (params?: PaginationParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) requestParams.page = params.page;
    if (params?.limit !== undefined) requestParams.limit = params.limit;
    if (params?.search !== undefined && params.search.trim())
      requestParams.search = params.search.trim();
    if (params?.updatedAtAfter)
      requestParams.updatedAtAfter = params.updatedAtAfter;
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;

    return api.get<PaginatedResponse<Customer> | Customer[]>("/customers", {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  getById: (id: string, params?: { storeId?: string | null }) => {
    const requestParams: Record<string, string> = {};
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;
    return api.get<Customer>(`/customers/${id}`, {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  create: (data: CreateCustomerDto) => {
    return api.post<Customer>("/customers", data);
  },

  update: (
    id: string,
    data: UpdateCustomerDto,
    params?: { storeId?: string | null }
  ) => {
    const requestParams: Record<string, string> = {};
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;
    return api.patch<Customer>(`/customers/${id}`, data, {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  delete: (id: string, params?: { storeId?: string | null }) => {
    const requestParams: Record<string, string> = {};
    if (params?.storeId != null && params.storeId !== "")
      requestParams.storeId = params.storeId;
    return api.delete(`/customers/${id}`, {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },
};
