import axios, { AxiosError } from "axios";
import { isNetworkErrorLike } from "@/lib/network-error";
import {
  getConfiguredApiUrl,
  resolveApiBaseUrl,
} from "@/lib/api/resolve-api-base-url";
import { getStoredAuthToken } from "@/lib/auth-token-storage";

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

function createOfflineError(
  message: string,
  name: string,
  flags: Pick<OfflineError, "isOffline" | "isNetworkError" | "retryable">
): OfflineError {
  const error = new Error(message) as OfflineError;
  error.name = name;
  error.isOffline = flags.isOffline;
  error.isNetworkError = flags.isNetworkError;
  error.retryable = flags.retryable;
  return error;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = resolveApiBaseUrl();
    const token = getStoredAuthToken();
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
      return Promise.reject(
        createOfflineError("No internet connection", "OfflineError", {
          isOffline: true,
          isNetworkError: true,
          retryable: true,
        })
      );
    }

    if (
      error.code === "ERR_NETWORK" ||
      error.message === "Network Error" ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      const networkError = createOfflineError(
        "Network request failed. Please check your connection.",
        "NetworkError",
        { isNetworkError: true, retryable: true }
      );

      if (
        process.env.NODE_ENV === "development" &&
        (error?.config?.url?.includes("/categories") ||
          error?.config?.url?.includes("/products"))
      ) {
        const win = globalThis.window as Window & {
          __backendNetworkErrorLogged?: boolean;
        };
        if (!win.__backendNetworkErrorLogged) {
          console.warn(
            "Backend not available - running in offline mode. Categories and products will be managed locally.",
            {
              backendUrl: getConfiguredApiUrl(),
            }
          );
          win.__backendNetworkErrorLogged = true;
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
