"use client";

import { usePathname } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Store,
  Home,
  ShoppingCart,
  PackageCheck,
  ShoppingBasket,
  Ticket,
  LayoutGrid,
  ScrollText,
  Users,
  BookOpen,
} from "lucide-react";
import { useSettings } from "../settings-provider";
import { useHardwareSetup } from "@/components/hardware-setup/HardwareSetupProvider";
import {
  useBackendNotifications,
  getCreditNotificationLink,
} from "@/hooks/use-backend-notifications";
import type { AppNotification } from "@/types/notifications";
import { logNotificationActionError } from "@/lib/notification-errors";
import { HeaderBrand } from "@/components/layout/header-brand";
import { HeaderDevOfflineToggle } from "@/components/layout/header-dev-offline-toggle";
import { HeaderNotificationsPopover } from "@/components/layout/header-notifications-popover";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/catalogue": "Catalogue",
  "/inventory": "Inventory",
  "/transactions": "Orders",
  "/customers": "Customers",
  "/buy-stock": "Buy Stock",
  "/vouchers": "Campaigns",
  "/marketplace": "Marketplace",
  "/boph": "BOPH",
  "/settings": "Settings",
  "/profile": "Profile",
};

const pageIcons: Record<string, React.ElementType> = {
  "/": Home,
  "/catalogue": BookOpen,
  "/inventory": LayoutGrid,
  "/transactions": ScrollText,
  "/customers": Users,
  "/buy-stock": ShoppingCart,
  "/vouchers": Ticket,
  "/marketplace": ShoppingBasket,
  "/boph": PackageCheck,
};

function resolvePageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/marketplace/")) return "Marketplace Store";
  return "Dashboard";
}

export default function Header() {
  const { settings, logout } = useSettings();
  const { currentUser, currentStore } = settings;
  const pathname = usePathname();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { openHardwareSetup } = useHardwareSetup();

  useEffect(() => setMounted(true), []);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshList,
    loading: notificationsLoading,
  } = useBackendNotifications({
    enabled: mounted && Boolean(currentUser),
    listUnreadOnly: false,
  });

  const currentPageTitle = useMemo(
    () => resolvePageTitle(pathname),
    [pathname]
  );
  const PageIcon = pageIcons[pathname] || Store;

  const handleNotificationClick = useCallback(
    async (notification: AppNotification) => {
      if (!notification.readAt) {
        try {
          await markAsRead(notification.id);
        } catch (error) {
          logNotificationActionError("mark as read", error);
        }
      }
      if (getCreditNotificationLink(notification)) {
        setNotificationOpen(false);
      }
    },
    [markAsRead]
  );

  useEffect(() => {
    if (notificationOpen) refreshList();
  }, [notificationOpen, refreshList]);

  const handleMarkAllReadClick = useCallback(() => {
    markAllAsRead().catch((error) => {
      logNotificationActionError("mark all as read", error);
    });
  }, [markAllAsRead]);

  const handleMarkOneRead = useCallback(
    (id: string) => {
      markAsRead(id).catch((error) => {
        logNotificationActionError("mark as read", error);
      });
    },
    [markAsRead]
  );

  const handleNotificationLinkClick = useCallback(
    (notification: AppNotification) => {
      handleNotificationClick(notification).catch((error) => {
        logNotificationActionError("open notification", error);
      });
    },
    [handleNotificationClick]
  );

  const handleNotificationOpenChange = useCallback(
    (open: boolean) => {
      setNotificationOpen(open);
      if (open) refreshList();
    },
    [refreshList]
  );

  return (
    <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 border-b bg-white dark:bg-card px-2 sm:px-4 lg:px-6 shadow-sm w-full max-w-full min-w-0">
      <HeaderBrand
        pageTitle={currentPageTitle}
        PageIcon={PageIcon}
        currentStore={currentStore}
      />

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <HeaderDevOfflineToggle mounted={mounted} />

        <HeaderNotificationsPopover
          open={notificationOpen}
          onOpenChange={handleNotificationOpenChange}
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationsLoading}
          onMarkAllRead={handleMarkAllReadClick}
          onMarkRead={handleMarkOneRead}
          onLinkClick={handleNotificationLinkClick}
        />

        <HeaderUserMenu
          currentUser={currentUser}
          currentStore={currentStore}
          onOpenHardwareSetup={openHardwareSetup}
          onLogout={logout}
        />
      </div>
    </header>
  );
}
