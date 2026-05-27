import { api } from "./core";
import type { AppNotification } from "@/types/notifications";
import type { PaginatedResponse } from "@/types/pagination";

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  getAll: (params?: GetNotificationsParams) => {
    const requestParams: Record<string, number | string | boolean> = {};
    if (params?.page !== undefined) requestParams.page = params.page;
    if (params?.limit !== undefined)
      requestParams.limit = Math.min(100, params.limit);
    if (params?.unreadOnly === true) requestParams.unreadOnly = true;
    return api.get<PaginatedResponse<AppNotification> | AppNotification[]>(
      "/notifications",
      {
        params:
          Object.keys(requestParams).length > 0 ? requestParams : undefined,
      }
    );
  },

  getUnreadCount: () =>
    api.get<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    api.patch<AppNotification>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<{ updated: number }>("/notifications/read-all"),
};
