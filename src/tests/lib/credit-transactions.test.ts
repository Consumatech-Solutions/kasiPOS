import { describe, it, expect } from "vitest";
import {
  getTransactionStatus,
  isPendingCreditTransaction,
  getCreditDueAt,
} from "@/lib/credit-transactions";
import type { Transaction } from "@/types";

const base: Transaction = {
  storeId: "s1",
  items: [],
  total: 100,
  paymentMethod: "Cash",
};

describe("credit-transactions", () => {
  it("defaults credit sales to pending when status omitted", () => {
    expect(getTransactionStatus({ ...base, paymentMethod: "Credit" })).toBe(
      "pending"
    );
    expect(
      isPendingCreditTransaction({ ...base, paymentMethod: "Credit" })
    ).toBe(true);
  });

  it("treats paid credit as not pending", () => {
    const tx = {
      ...base,
      paymentMethod: "Credit" as const,
      status: "paid" as const,
    };
    expect(isPendingCreditTransaction(tx)).toBe(false);
  });

  it("treats credit with creditSettledAt as paid when status omitted", () => {
    const tx = {
      ...base,
      paymentMethod: "Credit" as const,
      creditSettledAt: "2026-01-02T00:00:00.000Z",
    };
    expect(getTransactionStatus(tx)).toBe("paid");
    expect(isPendingCreditTransaction(tx)).toBe(false);
  });

  it("resolves credit due from creditDueAt or creditDetails", () => {
    expect(
      getCreditDueAt({
        ...base,
        paymentMethod: "Credit",
        creditDueAt: "2026-04-01T10:00:00.000Z",
      })
    ).toBe("2026-04-01T10:00:00.000Z");
    expect(
      getCreditDueAt({
        ...base,
        paymentMethod: "Credit",
        creditDetails: { dueAt: "2026-04-02T12:00:00.000Z" },
      })
    ).toBe("2026-04-02T12:00:00.000Z");
  });
});
