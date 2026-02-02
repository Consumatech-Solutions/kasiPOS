/**
 * Global notification pattern for the app.
 * Use for consistent success/error feedback (toast) with actionable messages.
 *
 * Usage:
 *   import { feedback } from '@/lib/feedback';
 *   feedback.success('Saved', 'Your changes were saved.');
 *   feedback.error('Failed to save', err.message, 'Check your connection and try again.', err.code);
 */

import { toast } from '@/hooks/use-toast';

const LOG_ID_PREFIX = 'KPOS';

/** Generate a short log ID for support (e.g. KPOS-a1b2c3). */
function genLogId(): string {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${LOG_ID_PREFIX}-${part}`;
}

/** Extract a user-friendly message from an unknown error. */
function getErrorMessage(error: unknown): string {
  if (error == null) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const obj = error as { message?: string; response?: { data?: { message?: string } } };
  if (obj?.response?.data?.message) return obj.response.data.message;
  if (obj?.message) return String(obj.message);
  return 'Something went wrong.';
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
   * Show a success toast.
   * Use after completing an action (save, delete, submit).
   */
  success(title: string, description?: string): void {
    toast({
      title,
      description: description ?? undefined,
      variant: 'default',
    });
  },

  /**
   * Show an error toast with optional recovery suggestion and log ID for support.
   * Use in catch blocks for async operations.
   */
  error(
    title: string,
    reason?: string,
    recovery?: string,
    options?: { logId?: string; code?: string }
  ): void {
    const logId = options?.logId ?? genLogId();
    const parts: string[] = [];
    if (reason) parts.push(reason);
    if (recovery) parts.push(recovery);
    if (options?.code || logId) {
      parts.push(`Ref: ${options?.code ? `${options.code} · ` : ''}${logId}`);
    }
    toast({
      title,
      description: parts.length > 0 ? parts.join(' ') : undefined,
      variant: 'destructive',
    });
  },

  /**
   * Show an error toast from a caught error (extracts message, optional recovery, log ID).
   */
  fromError(
    error: unknown,
    title: string = 'Action failed',
    recovery?: string
  ): string {
    const logId = genLogId();
    const reason = getErrorMessage(error);
    const code = (error as { code?: string })?.code;
    feedback.error(title, reason, recovery, { logId, code });
    return logId;
  },
};

export { genLogId, getErrorMessage };

