import { describe, expect, it } from "vitest";
import { getTransactionApiId, isTransactionUuid } from "@/lib/transaction-id";

describe("transaction-id", () => {
  it("detects UUIDs", () => {
    expect(isTransactionUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      true
    );
    expect(isTransactionUuid("1")).toBe(false);
    expect(isTransactionUuid("temp-123")).toBe(false);
    expect(isTransactionUuid(undefined)).toBe(false);
  });

  it("prefers serverId over local id", () => {
    expect(
      getTransactionApiId({
        id: "1",
        serverId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns null when neither id is a UUID", () => {
    expect(getTransactionApiId({ id: "1" })).toBeNull();
  });
});
