/**
 * Global notification system for the app.
 * Single standard way to show success/error: toast with clear, actionable messages.
 *
 * Rules:
 * - Success: clear confirmation (e.g. "Sale recorded successfully").
 * - Error: what failed + why (if known) + what to do next (e.g. "Sale failed — check your connection and try again").
 * - Always log errors for devs (console.error with ref/code).
 * - Optional error code in message for support (e.g. "Ref: SALE-001 · KPOS-abc123").
 *
 * Usage:
 *   import { feedback } from '@/lib/feedback';
 *   feedback.success('Sale recorded', 'Sale recorded successfully.');
 *   feedback.error('Sale failed', 'Server unreachable.', 'Check your connection and try again.', { code: 'SALE-001' });
 *   catch (err) { feedback.fromError(err, 'Sale failed', 'Check your connection and try again.', 'SALE-001'); }
 */

import { toast } from '@/hooks/use-toast';

const LOG_ID_PREFIX = 'KPOS';

/** Generate a short log ID for support (e.g. KPOS-a1b2c3). */
function genLogId(): string {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${LOG_ID_PREFIX}-${part}`;
}

/** Extract a user-friendly message from an unknown error (no stack traces or technical jargon). */
export function getErrorMessage(error: unknown): string {
  if (error == null) return 'Something went wrong.';
  if (typeof error === 'string') return error;
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
    if (Array.isArray(msg) && msg.length > 0 && typeof msg[0] === 'string') return msg[0].trim();
    if (typeof msg === 'string' && (msg as string).trim()) return (msg as string).trim();
    if (typeof data.error === 'string' && (data.error as string).trim()) return (data.error as string).trim();
    if (typeof data.msg === 'string' && (data.msg as string).trim()) return (data.msg as string).trim();
    // Validation-style: errors array or field-keyed object
    const errors = data.errors;
    if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'string') return (errors[0] as string).trim();
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      const first = Object.values(errors)[0];
      if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') return (first[0] as string).trim();
    }
  }
  // For 4xx, avoid showing generic Axios "Request failed with status code 400"
  if (status === 400) return 'The request was rejected. Check your input and try again.';
  if (status && status >= 400 && status < 500) return 'The request was rejected. Please try again.';
  if (error instanceof Error) return error.message;
  if (obj?.message) return String(obj.message);
  return 'Something went wrong.';
}

/** Build description for error toast: reason, recovery, then ref for support. */
function buildErrorDescription(reason?: string, recovery?: string, code?: string, logId?: string): string {
  const parts: string[] = [];
  if (reason) parts.push(reason);
  if (recovery) parts.push(recovery);
  if (code || logId) {
    const ref = [code, logId].filter(Boolean).join(' · ');
    parts.push(`Ref: ${ref}`);
  }
  return parts.join(' ');
}

/**
 * Use in components for consistent success/error toasts.
 * Prefer feedback.success() after completion and feedback.fromError() in catch blocks.
 */
export function useAppFeedback() {
  return feedback;
}

export const feedback = {
  /**
   * Show a success toast. Use after completing an action (save, delete, submit).
   * Example: feedback.success('Sale recorded', 'Sale recorded successfully.');
   */
  success(title: string, description?: string): void {
    toast({
      title,
      description: description ?? undefined,
      variant: 'default',
    });
  },

  /**
   * Show an error toast with reason, recovery suggestion, and optional ref for support.
   * Use in catch blocks or when validation fails.
   * Example: feedback.error('Sale failed', 'Server unreachable.', 'Check your connection and try again.', { code: 'SALE-001' });
   */
  error(
    title: string,
    reason?: string,
    recovery?: string,
    options?: { logId?: string; code?: string }
  ): void {
    const logId = options?.logId ?? genLogId();
    const description = buildErrorDescription(reason, recovery, options?.code, logId);
    toast({
      title,
      description: description || undefined,
      variant: 'destructive',
    });
    if (typeof window !== 'undefined') {
      console.error('[Feedback]', title, description, { logId, code: options?.code });
    }
  },

  /**
   * Show an error toast from a caught error. Extracts user-friendly message, shows recovery, logs for devs.
   * Always use in catch blocks for async operations so the user knows what happened and what to do next.
   * Example: catch (err) { feedback.fromError(err, 'Sale failed', 'Check your connection and try again.', 'SALE-001'); }
   */
  fromError(
    error: unknown,
    title: string = 'Action failed',
    recovery: string = 'Check your connection and try again.',
    code?: string
  ): string {
    const logId = genLogId();
    const reason = getErrorMessage(error);
    feedback.error(title, reason, recovery, { logId, code });
    return logId;
  },
};

export { genLogId };
