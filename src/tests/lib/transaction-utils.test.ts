import { describe, it, expect } from "vitest";
import {
  formatTransactionIdShort,
  isSafeTransactionIdForLink,
  transactionIdString,
} from "@/lib/transaction-utils";
import { getCreditNotificationLink } from "@/hooks/use-backend-notifications";
import type { AppNotification } from "@/types/notifications";

describe("transaction-utils", () => {
  it("stringifies numeric ids", () => {
    expect(transactionIdString(42)).toBe("42");
    expect(formatTransactionIdShort(42)).toBe("42");
  });

  it("validates safe transaction ids for links", () => {
    expect(
      isSafeTransactionIdForLink("550e8400-e29b-41d4-a716-446655440000")
    ).toBe(true);
    expect(isSafeTransactionIdForLink("42")).toBe(true);
    expect(isSafeTransactionIdForLink("javascript:alert(1)")).toBe(false);
    expect(isSafeTransactionIdForLink("../admin")).toBe(false);
  });
});

describe("getCreditNotificationLink", () => {
  const base: AppNotification = {
    id: "n1",
    type: "credit_payment_reminder",
    title: "Due",
    body: "Pay",
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("builds highlight link only for safe transaction ids", () => {
    expect(
      getCreditNotificationLink({
        ...base,
        metadata: {
          transactionId: "550e8400-e29b-41d4-a716-446655440000",
        },
      })
    ).toBe("/transactions?highlight=550e8400-e29b-41d4-a716-446655440000");
  });

  it("falls back when transaction id is unsafe", () => {
    expect(
      getCreditNotificationLink({
        ...base,
        metadata: { transactionId: "<script>" },
      })
    ).toBe("/transactions?filter=pending-credit");
  });
});
