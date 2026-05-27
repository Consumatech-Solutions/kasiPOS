export type ParsedSaleError = {
  status?: number;
  serverMessage?: string;
  fallbackMessage: string;
  showInPopup: boolean;
  popupMessage: string;
};

export function parseCompleteSaleError(error: unknown): ParsedSaleError {
  const err = error as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const response = err?.response;
  const status = response?.status;
  const data = response?.data as Record<string, unknown> | undefined;

  let serverMessage: string | undefined;
  if (data && typeof data === "object") {
    if (typeof data.message === "string") serverMessage = data.message;
    else if (Array.isArray(data.message) && data.message[0] != null)
      serverMessage = String(data.message[0]);
    else if (Array.isArray(data.errors) && data.errors[0] != null)
      serverMessage = String(data.errors[0]);
    else if (typeof data.error === "string") serverMessage = data.error;
  }

  const fallbackMessage =
    err?.message ?? (error instanceof Error ? error.message : String(error));
  const messageForUser = serverMessage ?? fallbackMessage;
  const showInPopup =
    status != null &&
    status >= 400 &&
    status < 500 &&
    (Boolean(messageForUser) || status === 400);

  const isStoreIdError =
    Boolean(messageForUser) && /storeId|integer/i.test(messageForUser);
  const isCreditNotConfigured =
    Boolean(messageForUser) &&
    /credit.*not configured|not configured.*credit/i.test(messageForUser);

  const popupMessage = isStoreIdError
    ? "Store configuration error. Please sign out, sign in again, then try the sale. If it persists, contact support."
    : isCreditNotConfigured
      ? "Credit is not configured for this store. Open Settings → Customer credit, choose this store, and save the credit limit and term."
      : messageForUser || "Something went wrong. Check the items and store.";

  return {
    status,
    serverMessage,
    fallbackMessage,
    showInPopup,
    popupMessage,
  };
}
