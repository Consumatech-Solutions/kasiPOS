import { describe, expect, it } from "vitest";
import { canClearCreditTransaction } from "@/lib/clear-credit";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("canClearCreditTransaction", () => {
  const pendingCredit = {
    id: UUID,
    paymentMethod: "Credit" as const,
    status: "pending",
  };

  it("allows store_admin and admin for pending credit", () => {
    expect(canClearCreditTransaction("store_admin", pendingCredit)).toBe(true);
    expect(canClearCreditTransaction("admin", pendingCredit)).toBe(true);
  });

  it("hides action for staff", () => {
    expect(canClearCreditTransaction("staff", pendingCredit)).toBe(false);
  });

  it("hides action for non-credit or non-pending", () => {
    expect(
      canClearCreditTransaction("store_admin", {
        ...pendingCredit,
        paymentMethod: "Cash",
      })
    ).toBe(false);
    expect(
      canClearCreditTransaction("store_admin", {
        ...pendingCredit,
        status: "paid",
      })
    ).toBe(false);
  });

  it("allows credit with missing status (legacy pending)", () => {
    expect(
      canClearCreditTransaction("store_admin", {
        id: "660e8400-e29b-41d4-a716-446655440001",
        paymentMethod: "Credit",
        status: undefined,
      })
    ).toBe(true);
  });

  it("hides action when already settled", () => {
    expect(
      canClearCreditTransaction("store_admin", {
        ...pendingCredit,
        status: undefined,
        creditSettledAt: "2026-08-04T12:00:00.000Z",
      })
    ).toBe(false);
  });

  it("hides action for Dexie auto-increment ids without serverId", () => {
    expect(
      canClearCreditTransaction("store_admin", {
        id: "1",
        paymentMethod: "Credit",
        status: "pending",
      })
    ).toBe(false);
  });

  it("allows action when serverId is a UUID even if id is local", () => {
    expect(
      canClearCreditTransaction("store_admin", {
        id: "1",
        serverId: UUID,
        paymentMethod: "Credit",
        status: "pending",
      })
    ).toBe(true);
  });
});
