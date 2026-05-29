"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import {
  normalizeNotificationsResponse,
  parseUnreadCountResponse,
} from "@/lib/api/notifications-parse";
import type { AppNotification } from "@/types/notifications";
import { shouldSkipBackendReads } from "@/lib/offline-detector";
import {
  transactionsHighlightLink,
  transactionsPendingCreditLink,
} from "@/lib/safe-app-links";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (filters?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

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
      if (shouldSkipBackendReads()) return { count: 0 };
      const res = await notificationsApi.getUnreadCount();
      return { count: parseUnreadCountResponse(res.data) };
    },
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
  });

  const listQuery = useQuery({
    queryKey: notificationKeys.list({
      unreadOnly: options?.listUnreadOnly,
      page: 1,
      limit: 20,
    }),
    queryFn: async () => {
      if (shouldSkipBackendReads()) {
        return normalizeNotificationsResponse([]);
      }
      const res = await notificationsApi.getAll({
        page: 1,
        limit: 20,
        unreadOnly: options?.listUnreadOnly,
      });
      return normalizeNotificationsResponse(res.data);
    },
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    staleTime: 15_000,
    retry: 1,
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
    () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    [queryClient]
  );

  return {
    notifications: listQuery.data?.data ?? [],
    unreadCount: unreadQuery.data?.count ?? 0,
    loading: listQuery.isLoading || unreadQuery.isLoading,
    error:
      (listQuery.error ?? unreadQuery.error)
        ? String(
            (listQuery.error ?? unreadQuery.error) instanceof Error
              ? (listQuery.error ?? unreadQuery.error)?.message
              : "Could not load notifications"
          )
        : null,
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
  const meta = notification.metadata;
  const transactionId =
    meta != null &&
    typeof meta === "object" &&
    "transactionId" in meta &&
    typeof meta.transactionId === "string"
      ? meta.transactionId.trim()
      : "";
  if (transactionId) {
    return transactionsHighlightLink(transactionId);
  }
  return transactionsPendingCreditLink();
}
