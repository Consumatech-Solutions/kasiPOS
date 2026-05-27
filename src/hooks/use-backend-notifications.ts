"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import type { AppNotification } from "@/types/notifications";
import type { PaginatedResponse, PaginationMeta } from "@/types/pagination";
import { checkOfflineStatus } from "@/lib/offline-detector";
import { isSafeTransactionIdForLink } from "@/lib/transaction-utils";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (filters?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

function normalizeNotificationsResponse(
  response: AppNotification[] | PaginatedResponse<AppNotification>
): { data: AppNotification[]; meta: PaginationMeta } {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: {
        total: response.length,
        page: 1,
        limit: response.length || 20,
        totalPages: 1,
      },
    };
  }
  if ("data" in response && "meta" in response) {
    return response;
  }
  return {
    data: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
}

const POLL_INTERVAL_MS = 60_000;

export function useBackendNotifications(options?: {
  enabled?: boolean;
  listUnreadOnly?: boolean;
}) {
  const enabled = options?.enabled !== false;
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      if (await checkOfflineStatus()) return { count: 0 };
      const res = await notificationsApi.getUnreadCount();
      return res.data;
    },
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const listQuery = useQuery({
    queryKey: notificationKeys.list({
      unreadOnly: options?.listUnreadOnly,
      page: 1,
      limit: 20,
    }),
    queryFn: async () => {
      if (await checkOfflineStatus()) {
        return {
          data: [] as AppNotification[],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      }
      const res = await notificationsApi.getAll({
        page: 1,
        limit: 20,
        unreadOnly: options?.listUnreadOnly,
      });
      return normalizeNotificationsResponse(res.data);
    },
    enabled,
    staleTime: 15_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const refreshList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: notificationKeys.lists() }),
    [queryClient]
  );

  return {
    notifications: listQuery.data?.data ?? [],
    unreadCount: unreadQuery.data?.count ?? 0,
    loading: listQuery.isLoading || unreadQuery.isLoading,
    refreshList,
    markAsRead: markReadMutation.mutateAsync,
    markAllAsRead: markAllReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}

export function getCreditNotificationLink(
  notification: AppNotification
): string | undefined {
  if (notification.type !== "credit_payment_reminder") return undefined;
  const meta = notification.metadata as { transactionId?: string } | undefined;
  const transactionId =
    typeof meta?.transactionId === "string" ? meta.transactionId.trim() : "";
  if (transactionId && isSafeTransactionIdForLink(transactionId)) {
    return `/transactions?highlight=${encodeURIComponent(transactionId)}`;
  }
  return "/transactions?filter=pending-credit";
}
