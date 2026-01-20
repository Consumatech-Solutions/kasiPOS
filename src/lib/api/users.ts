import { api } from './core';

export const usersApi = {
    findAll: (storeId?: number) => api.get('/users', { params: { storeId } }),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
};
