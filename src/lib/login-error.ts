import type { TFunction } from "i18next";
import { ERROR_CODES } from "@/lib/error-codes";
import { isBackendConnectionError } from "@/lib/backend-connection";

type LoginErrorResponse = {
  code?: string;
  message?: string;
  response?: { status?: number; data?: Record<string, unknown> };
};

export type LoginErrorFeedback = {
  title: string;
  message: string;
  hint?: string;
  code?: string;
};

function readServerMessage(
  data: Record<string, unknown> | undefined,
  status: number | undefined,
  t: TFunction
): string {
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.msg === "string") return data.msg;
  if (status === 401) return t("auth.login.invalidCredentials");
  return t("auth.login.failedRetry");
}

export function resolveLoginErrorFeedback(
  error: unknown,
  t: TFunction
): LoginErrorFeedback {
  const err = error as LoginErrorResponse;
  const data = err?.response?.data;
  const status = err?.response?.status;

  if (isBackendConnectionError(err)) {
    return {
      title: t("auth.login.failedTitle"),
      message: t("auth.login.failedConnection"),
    };
  }

  const serverMessage = readServerMessage(data, status, t);
  return {
    title: t("auth.login.failedTitle"),
    message: serverMessage,
    hint:
      status === 401
        ? t("auth.login.checkCredentials")
        : t("auth.login.tryAgainOrSignup"),
    code: ERROR_CODES.LOGIN,
  };
}
