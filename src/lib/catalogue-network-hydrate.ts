import { catalogueApi } from "@/lib/api/catalogue";
import { customersApi } from "@/lib/api/customers";
import type { ApiCategory, ApiProduct } from "@/types/catalogue";
import type { Customer } from "@/types";
import type { PaginationMeta } from "@/types/pagination";
import {
  saveProductsToDexie,
  saveCategoriesToDexie,
  saveCustomersToDexie,
} from "@/lib/entity-cache";

export function normalizeProducts(
  response: Awaited<ReturnType<typeof catalogueApi.products.getAll>>
): ApiProduct[] {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }
  if (Array.isArray(response)) return response;
  return [];
}

export function productsMetaFromResponse(
  response: Awaited<ReturnType<typeof catalogueApi.products.getAll>>
): PaginationMeta | null {
  if (
    response &&
    typeof response === "object" &&
    "meta" in response &&
    response.meta
  ) {
    return response.meta as PaginationMeta;
  }
  return null;
}

type PullAllOptions = {
  storeIdQueryParam?: boolean;
  updatedAtAfter?: string;
  onPageSaved?: (rowsSaved: number) => void;
};

function normalizeCategories(
  response: Awaited<ReturnType<typeof catalogueApi.categories.getAll>>
): ApiCategory[] {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }
  if (Array.isArray(response)) return response;
  return [];
}

function categoriesMeta(
  response: Awaited<ReturnType<typeof catalogueApi.categories.getAll>>
): PaginationMeta | null {
  if (
    response &&
    typeof response === "object" &&
    "meta" in response &&
    response.meta
  ) {
    return response.meta as PaginationMeta;
  }
  return null;
}

export async function pullAllProductsFromApi(
  storeIdForDexie: string,
  options?: PullAllOptions
): Promise<number> {
  const useStoreParam = options?.storeIdQueryParam !== false;
  const updatedAtAfter = options?.updatedAtAfter;
  let saved = 0;
  let page = 1;
  const limit = 100;
  const maxPages = 100;

  while (page <= maxPages) {
    const response = await catalogueApi.products.getAll({
      page,
      limit,
      ...(updatedAtAfter ? { updatedAtAfter } : {}),
      ...(useStoreParam ? { storeId: storeIdForDexie } : {}),
    });
    const rows = normalizeProducts(response);
    const meta = productsMetaFromResponse(response);
    if (rows.length > 0) {
      await saveProductsToDexie(rows, storeIdForDexie);
      saved += rows.length;
      options?.onPageSaved?.(rows.length);
    }
    const totalPages = meta?.totalPages ?? 1;
    if (page >= totalPages) break;
    if (!meta && rows.length < limit) break;
    page++;
  }
  return saved;
}

export async function pullAllCategoriesFromApi(
  storeIdForDexie: string,
  options?: PullAllOptions
): Promise<number> {
  const useStoreParam = options?.storeIdQueryParam !== false;
  const updatedAtAfter = options?.updatedAtAfter;
  let saved = 0;
  let page = 1;
  const limit = 50;
  const maxPages = 100;

  while (page <= maxPages) {
    const response = await catalogueApi.categories.getAll({
      page,
      limit,
      ...(updatedAtAfter ? { updatedAtAfter } : {}),
      ...(useStoreParam ? { storeId: storeIdForDexie } : {}),
    });
    const rows = normalizeCategories(response);
    const meta = categoriesMeta(response);
    if (rows.length > 0) {
      await saveCategoriesToDexie(rows, storeIdForDexie);
      saved += rows.length;
      options?.onPageSaved?.(rows.length);
    }
    const totalPages = meta?.totalPages ?? 1;
    if (page >= totalPages) break;
    if (!meta && rows.length < limit) break;
    page++;
  }
  return saved;
}

function normalizeCustomers(
  response: Awaited<ReturnType<typeof customersApi.getAll>>["data"]
): Customer[] {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }
  if (Array.isArray(response)) return response;
  return [];
}

function customersMetaFromResponse(
  response: Awaited<ReturnType<typeof customersApi.getAll>>["data"]
): PaginationMeta | null {
  if (
    response &&
    typeof response === "object" &&
    "meta" in response &&
    response.meta
  ) {
    return response.meta as PaginationMeta;
  }
  return null;
}

type PullAllCustomersOptions = {
  storeId?: string;
  updatedAtAfter?: string;
  onPageSaved?: (rowsSaved: number) => void;
};

export async function pullAllCustomersFromApi(
  options?: PullAllCustomersOptions
): Promise<number> {
  const storeId = options?.storeId;
  const updatedAtAfter = options?.updatedAtAfter;
  let saved = 0;
  let page = 1;
  const limit = 50;
  const maxPages = 100;

  while (page <= maxPages) {
    const response = await customersApi.getAll({
      page,
      limit,
      ...(updatedAtAfter ? { updatedAtAfter } : {}),
      ...(storeId ? { storeId } : {}),
    });
    const rows = normalizeCustomers(response.data);
    const meta = customersMetaFromResponse(response.data);
    if (rows.length > 0) {
      await saveCustomersToDexie(rows);
      saved += rows.length;
      options?.onPageSaved?.(rows.length);
    }
    const totalPages = meta?.totalPages ?? 1;
    if (page >= totalPages) break;
    if (!meta && rows.length < limit) break;
    page++;
  }

  return saved;
}

export function parseProductsListResponse(
  response: Awaited<ReturnType<typeof catalogueApi.products.getAll>>,
  page: number,
  limit: number
): { data: ApiProduct[]; meta: PaginationMeta } {
  const data = normalizeProducts(response);
  const metaFromApi = productsMetaFromResponse(response);
  if (metaFromApi) {
    return { data, meta: metaFromApi };
  }
  return {
    data,
    meta: {
      total: data.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.length / limit) || 1),
    },
  };
}

export function parseCategoriesListResponse(
  response: Awaited<ReturnType<typeof catalogueApi.categories.getAll>>,
  page: number,
  limit: number
): { data: ApiCategory[]; meta: PaginationMeta } {
  const data = normalizeCategories(response);
  const metaFromApi = categoriesMeta(response);
  if (metaFromApi) {
    return { data, meta: metaFromApi };
  }
  return {
    data,
    meta: {
      total: data.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.length / limit) || 1),
    },
  };
}
