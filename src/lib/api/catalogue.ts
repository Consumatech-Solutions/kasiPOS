import { api } from "./core";
import type {
  ApiCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  ApiProduct,
  CreateProductDto,
  UpdateProductDto,
  ProductTemplate,
  CategoryTemplate,
  AddTemplateRequest,
  AddTemplateProductResponse,
} from "@/types/catalogue";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

function catalogueListParams(params?: PaginationParams) {
  const query: Record<string, string> = {};
  if (params?.page != null) query.page = String(params.page);
  if (params?.limit != null) query.limit = String(params.limit);
  if (params?.updatedAtAfter) query.updatedAtAfter = params.updatedAtAfter;
  if (params?.storeId != null && params.storeId !== "")
    query.storeId = String(params.storeId);
  if (params?.search) query.search = params.search;
  if (params?.categoryId) query.categoryId = String(params.categoryId);
  return Object.keys(query).length > 0 ? query : undefined;
}

export const catalogueApi = {
  categories: {
    getAll: async (
      params?: PaginationParams
    ): Promise<ApiCategory[] | PaginatedResponse<ApiCategory>> => {
      const response = await api.get("/categories", {
        params: catalogueListParams(params),
      });

      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiCategory> => {
      const response = await api.get(`/categories/${id}`);
      return response.data;
    },

    create: async (data: CreateCategoryDto): Promise<ApiCategory> => {
      const response = await api.post("/categories", data);
      return response.data;
    },

    update: async (
      id: string,
      data: UpdateCategoryDto
    ): Promise<ApiCategory> => {
      const response = await api.patch(`/categories/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/categories/${id}`);
    },
  },

  products: {
    getAll: async (
      params?: PaginationParams
    ): Promise<ApiProduct[] | PaginatedResponse<ApiProduct>> => {
      const response = await api.get("/products", {
        params: catalogueListParams(params),
      });

      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiProduct> => {
      const response = await api.get(`/products/${id}`);
      return response.data;
    },

    create: async (data: CreateProductDto): Promise<ApiProduct> => {
      const response = await api.post("/products", data);
      return response.data;
    },

    update: async (id: string, data: UpdateProductDto): Promise<ApiProduct> => {
      const response = await api.patch(`/products/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/products/${id}`);
    },

    addTemplate: async (
      data: AddTemplateRequest
    ): Promise<AddTemplateProductResponse[]> => {
      const response = await api.post<AddTemplateProductResponse[]>(
        "/products/add-template",
        data
      );
      return Array.isArray(response.data)
        ? response.data
        : ((response.data as unknown as { data: AddTemplateProductResponse[] })
            ?.data ?? []);
    },
  },

  categoryTemplates: {
    getAll: async (): Promise<CategoryTemplate[]> => {
      const response = await api.get<
        CategoryTemplate[] | { data: CategoryTemplate[] }
      >("/category-templates");
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: CategoryTemplate[] })?.data ?? [];
    },
  },

  productTemplates: {
    getAll: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<
        ProductTemplate[] | { data: ProductTemplate[] }
      >("/product-templates");
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: ProductTemplate[] })?.data ?? [];
    },

    getForStore: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<ProductTemplate[]>(
        "/product-templates/for-store"
      );
      const raw = response.data;
      return Array.isArray(raw) ? raw : [];
    },
  },
};
