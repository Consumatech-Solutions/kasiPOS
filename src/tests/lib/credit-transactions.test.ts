import { describe, it, expect } from "vitest";
import {
  canMarkCreditAsPaid,
  isPendingCreditTransaction,
  creditDueAtFromTransaction,
  transactionDisplayStatus,
} from "@/lib/credit-transactions";
import type { Transaction } from "@/types";

const base: Transaction = {
  items: [],
  total: 100,
  paymentMethod: "Credit",
  storeId: "store-1",
};

describe("credit-transactions", () => {
  it("detects pending credit sales", () => {
    expect(isPendingCreditTransaction({ ...base, status: "pending" })).toBe(
      true
    );
    expect(isPendingCreditTransaction({ ...base, status: "paid" })).toBe(false);
    expect(isPendingCreditTransaction({ ...base, status: "failed" })).toBe(
      false
    );
    expect(
      isPendingCreditTransaction({
        ...base,
        status: "paid",
        creditSettledAt: "2026-01-01T00:00:00Z",
      })
    ).toBe(false);
  });

  it("defaults display status for credit without status field", () => {
    expect(transactionDisplayStatus(base)).toBe("pending");
    expect(transactionDisplayStatus({ ...base, status: "paid" })).toBe("paid");
    expect(
      transactionDisplayStatus({
        ...base,
        paymentMethod: "Cash",
      })
    ).toBe("paid");
  });

  it("reads due datetime from response fields", () => {
    expect(
      creditDueAtFromTransaction({
        ...base,
        creditDueAt: "2026-04-01T14:30:00Z",
      })
    ).toBe("2026-04-01T14:30:00Z");
    expect(
      creditDueAtFromTransaction({
        ...base,
        creditDetails: { dueAt: "2026-04-01T12:00:00Z" },
      })
    ).toBe("2026-04-01T12:00:00Z");
  });

  it("allows mark paid only when pending credit has server uuid", () => {
    expect(
      canMarkCreditAsPaid({
        ...base,
        status: "pending",
        id: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).toBe(true);
    expect(
      canMarkCreditAsPaid({
        ...base,
        status: "pending",
        id: "local-1730000000000",
      })
    ).toBe(false);
  });
});
