import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationsApi } from "@/lib/api/notifications";

vi.mock("@/lib/api/core", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from "@/lib/api/core";

describe("notificationsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches unread count", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 3 } });
    const res = await notificationsApi.getUnreadCount();
    expect(api.get).toHaveBeenCalledWith("/notifications/unread-count");
    expect(res.data.count).toBe(3);
  });

  it("marks one notification read", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    await notificationsApi.markRead("n-1");
    expect(api.patch).toHaveBeenCalledWith("/notifications/n-1/read");
  });
});
