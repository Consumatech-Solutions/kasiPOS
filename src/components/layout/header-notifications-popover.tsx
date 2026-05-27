"use client";

import type { ElementType } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getCreditNotificationLink } from "@/hooks/use-backend-notifications";
import type { AppNotification } from "@/types/notifications";

function getNotificationIcon(notification: AppNotification) {
  if (notification.type !== "credit_payment_reminder") return Info;
  const overdue = (notification.metadata as { overdue?: boolean } | undefined)
    ?.overdue;
  return overdue ? AlertCircle : AlertTriangle;
}

function getNotificationColor(notification: AppNotification) {
  if (notification.type !== "credit_payment_reminder") {
    return "text-blue-600 dark:text-blue-400";
  }
  const overdue = (notification.metadata as { overdue?: boolean } | undefined)
    ?.overdue;
  return overdue
    ? "text-red-600 dark:text-red-400"
    : "text-yellow-600 dark:text-yellow-400";
}

type NotificationRowProps = {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onLinkClick: (notification: AppNotification) => void;
};

function NotificationRow({
  notification,
  onMarkRead,
  onLinkClick,
}: NotificationRowProps) {
  const Icon = getNotificationIcon(notification);
  const colorClass = getNotificationColor(notification);
  const link = getCreditNotificationLink(notification);
  const item = (
    <NotificationItem
      notification={notification}
      Icon={Icon}
      colorClass={colorClass}
      onMarkRead={() => onMarkRead(notification.id)}
    />
  );

  if (!link) {
    return <div key={notification.id}>{item}</div>;
  }

  return (
    <div key={notification.id}>
      <Link
        href={link}
        onClick={() => onLinkClick(notification)}
        className="block"
      >
        {item}
      </Link>
    </div>
  );
}

type NotificationsListProps = {
  notifications: AppNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onLinkClick: (notification: AppNotification) => void;
};

function NotificationsList({
  notifications,
  loading,
  onMarkRead,
  onLinkClick,
}: NotificationsListProps) {
  if (loading && notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Loading notifications...
        </p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Bell className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">No notifications</p>
        <p className="text-xs text-muted-foreground mt-1">
          Credit payment reminders will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {notifications.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          onLinkClick={onLinkClick}
        />
      ))}
    </div>
  );
}

export type HeaderNotificationsPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onLinkClick: (notification: AppNotification) => void;
};

export function HeaderNotificationsPopover({
  open,
  onOpenChange,
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onMarkRead,
  onLinkClick,
}: HeaderNotificationsPopoverProps) {
  const badgeLabel = unreadCount > 9 ? "9+" : unreadCount;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 sm:h-10 sm:w-10 touch-target"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 ? (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 hover:bg-red-600"
              variant="destructive"
            >
              {badgeLabel}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[90vw] sm:w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onMarkAllRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <ScrollArea className="h-[400px]">
          <NotificationsList
            notifications={notifications}
            loading={loading}
            onMarkRead={onMarkRead}
            onLinkClick={onLinkClick}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: AppNotification;
  Icon: ElementType;
  colorClass: string;
  onMarkRead: () => void;
}

function NotificationItem({
  notification,
  Icon,
  colorClass,
  onMarkRead,
}: NotificationItemProps) {
  const isUnread = notification.readAt == null;
  const createdAt = new Date(notification.createdAt);

  return (
    <div
      className={cn(
        "relative px-4 py-3 hover:bg-muted/50 transition-colors",
        isUnread && "bg-muted/30"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn("text-sm font-medium", isUnread && "font-semibold")}
            >
              {notification.title}
            </p>
            {isUnread ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkRead();
                  }}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>
      {isUnread ? (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      ) : null}
    </div>
  );
}
