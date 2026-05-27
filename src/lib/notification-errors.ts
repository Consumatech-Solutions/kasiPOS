/** Dev-only logging for non-critical notification actions (Sonar: no empty catch). */
export function logNotificationActionError(
  action: string,
  error: unknown
): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Notifications] ${action} failed`, error);
  }
}
