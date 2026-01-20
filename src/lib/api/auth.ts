import { api } from './core';

export const authApi = {
    requestOtp: (phone: string) => api.post('/auth/request-otp', { phone }),
    verifyOtp: (phone: string, code: string) => api.post('/auth/verify-otp', { phone, code }),
    setPassword: (password: string, tempToken: string) =>
        api.post('/auth/set-password', { password }, {
            headers: { Authorization: `Bearer ${tempToken}` }
        }),
    login: (phone: string, password: string) => api.post('/auth/login', { phone, password }),
    getProfile: () => api.get('/auth/profile'),
};
