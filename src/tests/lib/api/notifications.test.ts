import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationsApi } from "@/lib/api/notifications";

vi.mock("@/lib/api/core", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import { api } from "@/lib/api/core";

describe("notificationsApi", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear();
    vi.mocked(api.patch).mockClear();
  });

  it("fetches unread count", async () => {
    await notificationsApi.getUnreadCount();
    expect(api.get).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("fetches list with unreadOnly", async () => {
    await notificationsApi.getAll({ page: 1, limit: 20, unreadOnly: true });
    expect(api.get).toHaveBeenCalledWith("/notifications", {
      params: { page: 1, limit: 20, unreadOnly: true },
    });
  });

  it("marks one notification read", async () => {
    await notificationsApi.markRead("n1");
    expect(api.patch).toHaveBeenCalledWith("/notifications/n1/read");
  });

  it("marks all notifications read", async () => {
    await notificationsApi.markAllRead();
    expect(api.patch).toHaveBeenCalledWith("/notifications/read-all");
  });
});
