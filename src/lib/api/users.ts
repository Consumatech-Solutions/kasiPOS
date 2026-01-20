import { api } from './core';

export const usersApi = {
    findAll: (storeId?: number, page: number = 1, limit: number = 10) => api.get('/users', { params: { storeId, page, limit } }),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
    remove: (id: string) => api.delete(`/users/${id}`),
};
