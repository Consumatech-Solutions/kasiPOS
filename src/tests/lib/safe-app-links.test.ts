import { describe, it, expect } from "vitest";
import {
  transactionsHighlightLink,
  transactionsPendingCreditLink,
} from "@/lib/safe-app-links";

describe("safe-app-links", () => {
  it("builds pending credit list link", () => {
    expect(transactionsPendingCreditLink()).toBe(
      "/transactions?filter=pending-credit"
    );
  });

  it("builds highlight link for safe ids", () => {
    expect(
      transactionsHighlightLink("550e8400-e29b-41d4-a716-446655440000")
    ).toBe("/transactions?highlight=550e8400-e29b-41d4-a716-446655440000");
  });

  it("falls back for unsafe ids", () => {
    expect(transactionsHighlightLink("javascript:alert(1)")).toBe(
      "/transactions?filter=pending-credit"
    );
  });
});
