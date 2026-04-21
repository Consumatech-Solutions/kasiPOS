import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { isNetworkErrorLike } from "@/lib/network-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";

// Check if we're online
const isOnline = () => {
  if (typeof navigator !== "undefined") {
    return navigator.onLine;
  }
  return true;
};

// Enhanced error type for offline scenarios
export interface OfflineError extends Error {
  isOffline?: boolean;
  isNetworkError?: boolean;
  retryable?: boolean;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - Axios will handle it automatically
    if (config.data instanceof FormData) {
      // Remove Content-Type header so Axios can set the boundary
      if (config.headers && "Content-Type" in config.headers) {
        delete config.headers["Content-Type"];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Enhanced response interceptor with offline handling and retry logic
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    // Check if we're offline
    if (!isOnline()) {
      const offlineError: OfflineError = new Error(
        "No internet connection",
      ) as OfflineError;
      offlineError.isOffline = true;
      offlineError.isNetworkError = true;
      offlineError.retryable = true;
      offlineError.name = "OfflineError";
      return Promise.reject(offlineError);
    }

    // Handle network errors (backend unavailable, timeout, etc.)
    if (
      error.code === "ERR_NETWORK" ||
      error.message === "Network Error" ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      const networkError: OfflineError = new Error(
        "Network request failed. Please check your connection.",
      ) as OfflineError;
      networkError.isNetworkError = true;
      networkError.retryable = true;
      networkError.name = "NetworkError";

      // Log only once in development for catalogue endpoints
      if (
        process.env.NODE_ENV === "development" &&
        (error?.config?.url?.includes("/categories") ||
          error?.config?.url?.includes("/products"))
      ) {
        if (!(window as any).__backendNetworkErrorLogged) {
          console.warn(
            "⚠️ Backend not available - running in offline mode. Categories and products will be managed locally.",
            {
              backendUrl:
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002",
            },
          );
          (window as any).__backendNetworkErrorLogged = true;
        }
      }

      return Promise.reject(networkError);
    }

    // Handle 401 (Unauthorized) - token missing or invalid
    if (error?.response?.status === 401) {
      // Could redirect to login here if needed
      // For now, let the calling code handle it
    }

    // Handle 400 (Bad Request) - don't log file upload errors
    if (error?.response?.status === 400) {
      const isFileUploadError = error?.config?.url?.includes("/files");

      if (isFileUploadError) {
        // Silent - reject without logging
        return Promise.reject(error);
      }

      // Log other 400 errors only in development
      if (process.env.NODE_ENV === "development") {
        console.warn("Bad Request (400):", {
          url: error?.config?.url,
          method: error?.config?.method,
          responseData: error?.response?.data,
        });
      }
    }

    // Handle 404 - expected for some endpoints when backend is not available
    if (error?.response?.status === 404) {
      // These errors are expected if backend is not started
      // Let the calling code handle them
    }

    // Handle 500+ server errors - these are retryable
    if (error?.response?.status && error.response.status >= 500) {
      const serverError: OfflineError = error as any;
      serverError.retryable = true;
      serverError.isNetworkError = false;
      return Promise.reject(serverError);
    }

    return Promise.reject(error);
  },
);

// Helper function to check if an error is retryable
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  // Offline errors are retryable
  if (error.isOffline || error.isNetworkError) {
    return true;
  }

  // Network errors are retryable
  if (isNetworkErrorLike(error)) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (error.response?.status >= 500) {
    return true;
  }

  // Timeout errors are retryable
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return true;
  }

  return false;
}

// Helper function to check if we're offline
export function isOfflineError(error: any): boolean {
  return (
    error?.isOffline === true || (!isOnline() && isNetworkErrorLike(error))
  );
}
