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
  if (error instanceof Error) return error.message;
  const obj = error as { message?: string; response?: { data?: { message?: string } } };
  if (obj?.response?.data?.message) return obj.response.data.message;
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
