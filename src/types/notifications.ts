export type CreditReminderKind =
  | "T48H"
  | "T24H"
  | "T12H"
  | "T1H"
  | "AT_DUE"
  | "OVERDUE";

export type AppNotificationType = "credit_payment_reminder";

export interface CreditNotificationMetadata {
  transactionId: string;
  reminderKind: CreditReminderKind;
  customerId?: string | null;
  customerName?: string | null;
  total: string;
  creditDueAt?: string | null;
  overdue?: boolean;
}

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  metadata?: CreditNotificationMetadata | Record<string, unknown> | null;
}
