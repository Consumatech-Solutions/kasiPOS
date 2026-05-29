import { describe, it, expect } from "vitest";
import { extractTransactionFromCreateResponse } from "@/lib/entity-cache";

describe("extractTransactionFromCreateResponse", () => {
  it("reads id from axios data body", () => {
    const tx = extractTransactionFromCreateResponse({
      data: { id: "550e8400-e29b-41d4-a716-446655440000", total: 23 },
    });
    expect(tx?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("reads id from nested data.data", () => {
    const tx = extractTransactionFromCreateResponse({
      data: { data: { id: "txn-99", total: 10 } },
    });
    expect(tx?.id).toBe("txn-99");
  });

  it("reads id from transaction wrapper", () => {
    const tx = extractTransactionFromCreateResponse({
      data: { transaction: { id: "abc-123", total: 5 } },
    });
    expect(tx?.id).toBe("abc-123");
  });
});
