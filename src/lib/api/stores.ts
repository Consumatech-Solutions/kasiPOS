import { api } from './core';

export const storesApi = {
    getMyStore: () => api.get('/stores/my-store'),
    create: (data: any) => api.post('/stores', data),
    update: (id: number, data: any) => api.patch(`/stores/${id}`, data),
};
