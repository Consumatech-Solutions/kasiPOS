import { toast } from "@/hooks/use-toast";

const LOG_ID_PREFIX = "KPOS";

function genLogId(): string {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${LOG_ID_PREFIX}-${part}`;
}

export function getErrorMessage(error: unknown): string {
  if (error == null) return "Something went wrong.";
  if (typeof error === "string") return error;
  const obj = error as {
    message?: string;
    response?: {
      status?: number;
      data?: {
        message?: string | string[];
        error?: string;
        msg?: string;
        errors?: string[] | Record<string, string[]>;
      };
    };
  };
  const data = obj?.response?.data as Record<string, unknown> | undefined;
  const status = obj?.response?.status;
  if (data) {
    const msg = data.message;
    if (Array.isArray(msg) && msg.length > 0 && typeof msg[0] === "string")
      return msg[0].trim();
    if (typeof msg === "string" && (msg as string).trim())
      return (msg as string).trim();
    if (typeof data.error === "string" && (data.error as string).trim())
      return (data.error as string).trim();
    if (typeof data.msg === "string" && (data.msg as string).trim())
      return (data.msg as string).trim();
    const errors = data.errors;
    if (
      Array.isArray(errors) &&
      errors.length > 0 &&
      typeof errors[0] === "string"
    )
      return (errors[0] as string).trim();
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const first = Object.values(errors)[0];
      if (
        Array.isArray(first) &&
        first.length > 0 &&
        typeof first[0] === "string"
      )
        return (first[0] as string).trim();
    }
  }
  if (status === 400)
    return "The request was rejected. Check your input and try again.";
  if (status && status >= 400 && status < 500)
    return "The request was rejected. Please try again.";
  if (error instanceof Error) return error.message;
  if (obj?.message) return String(obj.message);
  return "Something went wrong.";
}

function buildErrorDescription(
  reason?: string,
  recovery?: string,
  code?: string,
  logId?: string
): string {
  const parts: string[] = [];
  if (reason) parts.push(reason);
  if (recovery) parts.push(recovery);
  if (code || logId) {
    const ref = [code, logId].filter(Boolean).join(" · ");
    parts.push(`Ref: ${ref}`);
  }
  return parts.join(" ");
}

export function useAppFeedback() {
  return feedback;
}

export const feedback = {
  success(title: string, description?: string): void {
    toast({
      title,
      description: description ?? undefined,
      variant: "default",
    });
  },

  error(
    title: string,
    reason?: string,
    recovery?: string,
    options?: { logId?: string; code?: string }
  ): void {
    const logId = options?.logId ?? genLogId();
    const description = buildErrorDescription(
      reason,
      recovery,
      options?.code,
      logId
    );
    toast({
      title,
      description: description || undefined,
      variant: "destructive",
    });
    if (typeof window !== "undefined") {
      console.error("[Feedback]", title, description, {
        logId,
        code: options?.code,
      });
    }
  },

  fromError(
    error: unknown,
    title: string = "Action failed",
    recovery: string = "Check your connection and try again.",
    code?: string
  ): string {
    const logId = genLogId();
    const reason = getErrorMessage(error);
    feedback.error(title, reason, recovery, { logId, code });
    return logId;
  },
};

export { genLogId };
