import { describe, it, expect } from "vitest";
import {
  normalizeNotificationsResponse,
  parseUnreadCountResponse,
} from "@/lib/api/notifications-parse";

describe("notifications-parse", () => {
  it("parses unread count from nested body", () => {
    expect(parseUnreadCountResponse({ data: { count: 3 } })).toBe(3);
    expect(parseUnreadCountResponse({ count: 2 })).toBe(2);
  });

  it("parses paginated notifications list", () => {
    const { data } = normalizeNotificationsResponse({
      data: [
        {
          id: "n1",
          type: "credit_payment_reminder",
          title: "Credit due soon",
          body: "R23 due",
          readAt: null,
          createdAt: "2026-05-29T12:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("n1");
  });

  it("parses notifications array at root", () => {
    const { data } = normalizeNotificationsResponse([
      {
        id: "n2",
        type: "credit_payment_reminder",
        title: "Overdue",
        body: "Pay now",
        createdAt: "2026-05-29T12:00:00Z",
      },
    ]);
    expect(data[0].title).toBe("Overdue");
  });
});
