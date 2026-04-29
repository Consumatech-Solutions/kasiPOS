import axios, { AxiosError } from "axios";
import { isNetworkErrorLike } from "@/lib/network-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";

const isOnline = () => {
  if (typeof navigator !== "undefined") {
    return navigator.onLine;
  }
  return true;
};

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
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      if (config.headers && "Content-Type" in config.headers) {
        delete config.headers["Content-Type"];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!isOnline()) {
      const offlineError: OfflineError = new Error(
        "No internet connection"
      ) as OfflineError;
      offlineError.isOffline = true;
      offlineError.isNetworkError = true;
      offlineError.retryable = true;
      offlineError.name = "OfflineError";
      return Promise.reject(offlineError);
    }

    if (
      error.code === "ERR_NETWORK" ||
      error.message === "Network Error" ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      const networkError: OfflineError = new Error(
        "Network request failed. Please check your connection."
      ) as OfflineError;
      networkError.isNetworkError = true;
      networkError.retryable = true;
      networkError.name = "NetworkError";

      if (
        process.env.NODE_ENV === "development" &&
        (error?.config?.url?.includes("/categories") ||
          error?.config?.url?.includes("/products"))
      ) {
        if (!(window as any).__backendNetworkErrorLogged) {
          console.warn(
            "Backend not available - running in offline mode. Categories and products will be managed locally.",
            {
              backendUrl:
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002",
            }
          );
          (window as any).__backendNetworkErrorLogged = true;
        }
      }

      return Promise.reject(networkError);
    }

    if (error?.response?.status === 400) {
      const isFileUploadError = error?.config?.url?.includes("/files");

      if (isFileUploadError) {
        return Promise.reject(error);
      }

      if (process.env.NODE_ENV === "development") {
        console.warn("Bad Request (400):", {
          url: error?.config?.url,
          method: error?.config?.method,
          responseData: error?.response?.data,
        });
      }
    }

    if (error?.response?.status && error.response.status >= 500) {
      const serverError: OfflineError = error as any;
      serverError.retryable = true;
      serverError.isNetworkError = false;
      return Promise.reject(serverError);
    }

    return Promise.reject(error);
  }
);

export function isRetryableError(error: any): boolean {
  if (!error) return false;

  if (error.isOffline || error.isNetworkError) {
    return true;
  }

  if (isNetworkErrorLike(error)) {
    return true;
  }

  if (error.response?.status >= 500) {
    return true;
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return true;
  }

  return false;
}

export function isOfflineError(error: any): boolean {
  return (
    error?.isOffline === true || (!isOnline() && isNetworkErrorLike(error))
  );
}
