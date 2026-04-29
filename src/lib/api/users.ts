import { api } from "./core";

export interface UsersListResponse {
  data: Array<{
    id: string;
    email?: string;
    name: string;
    role: string;
    storeId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const usersApi = {
  findAll: (storeId?: string | null, page: number = 1, limit: number = 10) =>
    api.get<UsersListResponse>("/users", { params: { storeId, page, limit } }),
  create: (data: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
    storeId?: string;
  }) => api.post("/users", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};
