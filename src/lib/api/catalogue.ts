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

const API_BASE_PATH = "";

export const catalogueApi = {
  categories: {
    getAll: async (
      params?: PaginationParams
    ): Promise<ApiCategory[] | PaginatedResponse<ApiCategory>> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.updatedAtAfter)
        queryParams.append("updatedAtAfter", params.updatedAtAfter);
      if (params?.storeId)
        queryParams.append("storeId", String(params.storeId));

      const url = `${API_BASE_PATH}/categories${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await api.get(url);

      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiCategory> => {
      const response = await api.get(`${API_BASE_PATH}/categories/${id}`);
      return response.data;
    },

    create: async (data: CreateCategoryDto): Promise<ApiCategory> => {
      const response = await api.post(`${API_BASE_PATH}/categories`, data);
      return response.data;
    },

    update: async (
      id: string,
      data: UpdateCategoryDto
    ): Promise<ApiCategory> => {
      const response = await api.patch(
        `${API_BASE_PATH}/categories/${id}`,
        data
      );
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`${API_BASE_PATH}/categories/${id}`);
    },
  },

  products: {
    getAll: async (
      params?: PaginationParams
    ): Promise<ApiProduct[] | PaginatedResponse<ApiProduct>> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.search) queryParams.append("search", params.search);
      if (params?.categoryId)
        queryParams.append("categoryId", params.categoryId);
      if (params?.updatedAtAfter)
        queryParams.append("updatedAtAfter", params.updatedAtAfter);
      if (params?.storeId)
        queryParams.append("storeId", String(params.storeId));

      const url = `${API_BASE_PATH}/products${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await api.get(url);

      if (response.data?.meta) {
        return response.data;
      }
      return Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
    },

    getById: async (id: string): Promise<ApiProduct> => {
      const response = await api.get(`${API_BASE_PATH}/products/${id}`);

      const unwrap = (raw: unknown): unknown => {
        if (!raw || typeof raw !== "object") return raw;
        const obj = raw as Record<string, unknown>;

        // Handle common backend wrapper: { data: { ...product } }
        if (
          "data" in obj &&
          obj.data &&
          typeof obj.data === "object" &&
          !Array.isArray(obj.data)
        ) {
          const inner = obj.data as Record<string, unknown>;
          if ("name" in inner || "id" in inner || "productImage" in inner) {
            return unwrap(inner);
          }
        }

        return raw;
      };

      return unwrap(response.data) as ApiProduct;
    },

    create: async (data: CreateProductDto): Promise<ApiProduct> => {
      const response = await api.post(`${API_BASE_PATH}/products`, data);
      return response.data;
    },

    update: async (id: string, data: UpdateProductDto): Promise<ApiProduct> => {
      const response = await api.patch(`${API_BASE_PATH}/products/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`${API_BASE_PATH}/products/${id}`);
    },

    addTemplate: async (
      data: AddTemplateRequest
    ): Promise<AddTemplateProductResponse[]> => {
      const response = await api.post<AddTemplateProductResponse[]>(
        `${API_BASE_PATH}/products/add-template`,
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
      >(`${API_BASE_PATH}/category-templates`);
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: CategoryTemplate[] })?.data ?? [];
    },
  },

  productTemplates: {
    getAll: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<
        ProductTemplate[] | { data: ProductTemplate[] }
      >(`${API_BASE_PATH}/product-templates`);
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      return (raw as { data: ProductTemplate[] })?.data ?? [];
    },

    getForStore: async (): Promise<ProductTemplate[]> => {
      const response = await api.get<ProductTemplate[]>(
        `${API_BASE_PATH}/product-templates/for-store`
      );
      const raw = response.data;
      return Array.isArray(raw) ? raw : [];
    },
  },
};
