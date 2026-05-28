import { api } from "./core";
import type { AppNotification } from "@/types/notifications";
import type { PaginatedResponse } from "@/types/pagination";

export type GetNotificationsParams = {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
};

export const notificationsApi = {
  getAll: (params?: GetNotificationsParams) =>
    api.get<PaginatedResponse<AppNotification> | AppNotification[]>(
      "/notifications",
      {
        params: {
          ...(params?.page != null && { page: params.page }),
          ...(params?.limit != null && { limit: params.limit }),
          ...(params?.unreadOnly === true && { unreadOnly: true }),
        },
      }
    ),

  getUnreadCount: () =>
    api.get<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => api.patch("/notifications/read-all"),
};
