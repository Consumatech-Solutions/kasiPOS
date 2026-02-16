import { api } from './core';

/** GET /users response: { data: User[], meta: { total, page, limit, totalPages } } */
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
  /** GET /users - List users with optional storeId filter (page 1-based, limit per page). */
  findAll: (storeId?: string | null, page: number = 1, limit: number = 10) =>
    api.get<UsersListResponse>('/users', { params: { storeId, page, limit } }),
  /** POST /users - Create user (e.g. staff). Body: name, email (required), phone, role, storeId. Returns 201 with user. */
  create: (data: { name: string; email: string; phone?: string; role?: string; storeId?: string }) =>
    api.post('/users', data),
  /** PATCH /users/:id - Update user. */
  update: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
  /** DELETE /users/:id - Deactivate user. */
  remove: (id: string) => api.delete(`/users/${id}`),
};
