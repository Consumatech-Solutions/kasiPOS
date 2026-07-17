import { api } from "./core";
import type { User, Store, UpdateProfileDto } from "@/types";

export interface SetPasswordStoreAdminRequest {
  phone: string;
  temporaryPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export type SignupRequest = {
  email: string;
  name: string;
  storeName: string;
  password: string;
  countryCode: string;
  phoneNumber: string;
};

export type SignupResponse = {
  success: boolean;
  message: string;
  verificationChannel: "sms" | "email";
};

export type VerifySignupRequest = {
  email: string;
  code: string;
};

export type VerifySignupResponse = {
  accessToken: string;
  user: User;
  store: Store;
};

export type LoginRequest = {
  email?: string;
  phone?: string;
  password: string;
};

export type ForgotPasswordRequest = {
  email?: string;
  phone?: string;
};

export type VerifyPasswordResetRequest = {
  email?: string;
  phone?: string;
  code: string;
};

export type VerifyPasswordResetResponse = {
  tempToken: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message?: string;
};

export const authApi = {
  requestOtp: (phone: string) => api.post("/auth/request-otp", { phone }),
  verifyOtp: (phone: string, code: string) =>
    api.post("/auth/verify-otp", { phone, code }),
  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post("/auth/forgot-password", data),
  verifyPasswordReset: (data: VerifyPasswordResetRequest) =>
    api.post<VerifyPasswordResetResponse>("/auth/verify-password-reset", data),
  resetPassword: (data: ResetPasswordRequest) =>
    api.post<ResetPasswordResponse>("/auth/reset-password", data),
  setPassword: (password: string, tempToken: string) =>
    api.post<AuthResponse>(
      "/auth/set-password",
      { password },
      {
        headers: { Authorization: `Bearer ${tempToken}` },
      }
    ),
  setPasswordStoreAdmin: (data: SetPasswordStoreAdminRequest) =>
    api.post<AuthResponse>("/auth/set-password-store-admin", data),
  signup: (data: SignupRequest) =>
    api.post<SignupResponse>("/auth/signup", data),
  verifySignup: (data: VerifySignupRequest) =>
    api.post<VerifySignupResponse>("/auth/signup/verify", data),
  login: (data: LoginRequest) => api.post<AuthResponse>("/auth/login", data),
  getProfile: () => api.get<User>("/auth/profile"),
  updateProfile: (data: UpdateProfileDto) =>
    api.patch<User>("/auth/profile", data),
  logout: () => api.post("/auth/logout"),
};
