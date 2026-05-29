import { describe, it, expect } from "vitest";
import {
  formatTransactionIdShort,
  isSafeTransactionIdForLink,
  isServerTransactionId,
  resolveTransactionServerId,
  transactionIdString,
} from "@/lib/transaction-utils";
import { getDb, resetDbInstanceForTests } from "@/lib/db";
import type { Transaction } from "@/types";
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
    expect(isSafeTransactionIdForLink("javascript:alert(1)")).toBe(false);
  });

  it("detects server vs local transaction ids", () => {
    expect(isServerTransactionId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      true
    );
    expect(isServerTransactionId("local-123")).toBe(false);
    expect(isServerTransactionId("temp-abc")).toBe(false);
    expect(isServerTransactionId("TXN-123")).toBe(false);
    expect(isServerTransactionId("txn-001")).toBe(true);
  });

  it("resolveTransactionServerId uses syncIdMapping when cache id is local", async () => {
    await resetDbInstanceForTests();
    const serverId = "550e8400-e29b-41d4-a716-446655440000";
    const idempotencyKey = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    await getDb().syncIdMapping.put({
      tempId: idempotencyKey,
      serverId,
      createdAt: Date.now(),
    });
    const tx: Transaction = {
      id: "local-999",
      idempotencyKey,
      items: [],
      total: 10,
      paymentMethod: "Credit",
      storeId: "store-1",
    };
    expect(await resolveTransactionServerId(tx)).toBe(serverId);
    await resetDbInstanceForTests();
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

  it("builds highlight link for safe transaction ids", () => {
    expect(
      getCreditNotificationLink({
        ...base,
        metadata: {
          transactionId: "550e8400-e29b-41d4-a716-446655440000",
          reminderKind: "T24H",
          total: "100",
        },
      })
    ).toBe("/transactions?highlight=550e8400-e29b-41d4-a716-446655440000");
  });
});
