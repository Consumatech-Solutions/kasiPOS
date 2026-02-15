import { api } from './core';
import type { User, UpdateProfileDto } from '@/types';

export interface SetPasswordStoreAdminRequest {
    phone: string;
    temporaryPassword: string;
    newPassword: string;
}

export interface AuthResponse {
    accessToken: string;
    user: User;
}

export const authApi = {
    requestOtp: (phone: string) => api.post('/auth/request-otp', { phone }),
    verifyOtp: (phone: string, code: string) => api.post('/auth/verify-otp', { phone, code }),
    setPassword: (password: string, tempToken: string) =>
        api.post<AuthResponse>('/auth/set-password', { password }, {
            headers: { Authorization: `Bearer ${tempToken}` }
        }),
    /** Store admin: set password (no auth). Uses phone + temporaryPassword from SMS + newPassword. */
    setPasswordStoreAdmin: (data: SetPasswordStoreAdminRequest) =>
        api.post<AuthResponse>('/auth/set-password-store-admin', data),
    login: (phone: string, password: string) => api.post<AuthResponse>('/auth/login', { phone, password }),
    getProfile: () => api.get<User>('/auth/profile'),
    updateProfile: (data: UpdateProfileDto) => api.patch<User>('/auth/profile', data),
    logout: () => api.post('/auth/logout'),
};
