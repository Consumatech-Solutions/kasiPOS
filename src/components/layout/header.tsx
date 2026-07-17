"use client";

import { usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Store,
  User,
  Bell,
  Wifi,
  ShoppingCart,
  PackageCheck,
  ShoppingBasket,
  Ticket,
  LayoutGrid,
  ScrollText,
  Users,
  BookOpen,
  Check,
  CheckCheck,
  X,
  Home,
  DollarSign,
  LayoutDashboard,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Printer,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { useSettings } from "../settings-provider";
import { useHardwareSetup } from "@/components/hardware-setup/HardwareSetupProvider";
import {
  useNotifications,
  type Notification,
  type NotificationType,
} from "@/hooks/use-notifications";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { offlineDetector } from "@/lib/offline-detector";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr as frDateFns } from "date-fns/locale";
import type { Locale } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/** Pathname → i18n key (default namespace `translation`) */
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "nav.home",
  "/dashboard": "nav.dashboard",
  "/catalogue": "nav.catalogue",
  "/inventory": "nav.inventory",
  "/sale": "nav.sales",
  "/transactions": "nav.orders",
  "/customers": "nav.customers",
  "/buy-stock": "nav.buyStock",
  "/vouchers": "nav.campaigns",
  "/marketplace": "nav.marketplace",
  "/boph": "nav.boph",
  "/settings": "nav.settings",
  "/profile": "header.menu.profile",
};

const pageIcons: Record<string, React.ElementType> = {
  "/": Home,
  "/dashboard": LayoutDashboard,
  "/catalogue": BookOpen,
  "/inventory": LayoutGrid,
  "/sale": DollarSign,
  "/transactions": ScrollText,
  "/customers": Users,
  "/buy-stock": ShoppingCart,
  "/vouchers": Ticket,
  "/marketplace": ShoppingBasket,
  "/boph": PackageCheck,
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "success":
      return CheckCircle;
    case "warning":
      return AlertTriangle;
    case "error":
      return AlertCircle;
    default:
      return Info;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case "success":
      return "text-green-600 dark:text-green-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    case "error":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-blue-600 dark:text-blue-400";
  }
};

type HeaderProps = {
  onOpenMobileNav?: () => void;
};

export default function Header({ onOpenMobileNav }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const dateLocale: Locale = i18n.language?.startsWith("fr") ? frDateFns : enUS;
  const { settings, logout } = useSettings();
  const { currentUser, currentStore } = settings;
  const pathname = usePathname();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications();
  const { isOnline, wasOffline, hasInternet, cloudUnreachable } =
    useNetworkStatus();
  const { openHardwareSetup } = useHardwareSetup();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentPageTitle = useMemo(() => {
    const titleKey = PAGE_TITLE_KEYS[pathname];
    if (titleKey) {
      return t(titleKey);
    }
    if (pathname.startsWith("/marketplace/")) {
      return t("header.pageTitle.marketplaceStore");
    }
    return t("header.pageTitle.dashboard");
  }, [pathname, t]);

  const PageIcon = pageIcons[pathname] || Store;

  const roleLabel = (role: string) => {
    const norm = String(role).toLowerCase().replace(/\s+/g, "_");
    if (norm === "admin" || norm === "store_admin" || norm === "staff") {
      return t(`settings.staff.role.${norm}`);
    }
    return role;
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setNotificationOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 border-b bg-white dark:bg-card px-2 sm:px-4 lg:px-6 shadow-sm w-full max-w-full min-w-0">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {onOpenMobileNav && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 touch-target shrink-0"
            onClick={onOpenMobileNav}
            aria-label={t("header.menu.navigation")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Link
          href="/"
          className="flex items-center gap-1 sm:gap-2 flex-shrink-0"
        >
          {!logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt="kasiPOS"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="bg-green-500 p-1.5 sm:p-2 rounded-md">
              <Store className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          )}
          <span className="text-base sm:text-lg font-bold hidden sm:inline">
            kasiPOS
          </span>
        </Link>

        <div className="flex items-center gap-2 text-muted-foreground min-w-0 flex-1 md:flex-none">
          <div className="hidden md:block h-6 w-px bg-border" />
          <PageIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">
            {currentPageTitle}
          </span>
        </div>

        {currentStore && (
          <div className="hidden lg:flex items-center gap-2 ml-auto mr-4">
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {currentStore.name}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {mounted &&
          process.env.NODE_ENV === "development" &&
          offlineDetector.isDevHost() && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
              <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                {t("header.dev.simulateOffline")}
              </span>
              <Switch
                checked={offlineDetector.getForceOffline()}
                onCheckedChange={(checked) =>
                  offlineDetector.setForceOffline(checked)
                }
                aria-label={t("header.dev.simulateOffline")}
              />
            </div>
          )}

        <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 sm:h-10 sm:w-10 touch-target"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 hover:bg-red-600"
                  variant="destructive"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[90vw] sm:w-80 p-0" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">
                  {t("header.notifications.title")}
                </h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t("header.notifications.new", { count: unreadCount })}
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  {t("header.notifications.markAllRead")}
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    {t("header.notifications.empty")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("header.notifications.emptyHint")}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const colorClass = getNotificationColor(notification.type);
                    const content = notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => handleNotificationClick(notification)}
                        className="block"
                      >
                        <NotificationItem
                          notification={notification}
                          Icon={Icon}
                          colorClass={colorClass}
                          dateLocale={dateLocale}
                          onMarkRead={() => markAsRead(notification.id)}
                          onRemove={() => removeNotification(notification.id)}
                        />
                      </Link>
                    ) : (
                      <NotificationItem
                        notification={notification}
                        Icon={Icon}
                        colorClass={colorClass}
                        dateLocale={dateLocale}
                        onMarkRead={() => markAsRead(notification.id)}
                        onRemove={() => removeNotification(notification.id)}
                      />
                    );
                    return <div key={notification.id}>{content}</div>;
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full touch-target"
            >
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {currentUser?.name ? (
                    currentUser.name
                      .split(" ")
                      .map((n) => n.charAt(0))
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 sm:w-56 p-2"
            align="end"
            sideOffset={8}
            alignOffset={-4}
            collisionPadding={8}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {currentUser?.name || t("header.user.fallbackName")}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.phone || t("header.user.noPhone")}
                </p>
                {currentUser?.role && (
                  <Badge
                    variant="secondary"
                    className="w-fit mt-1 text-[10px] px-1.5 py-0"
                  >
                    {roleLabel(currentUser.role)}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/profile">
              <DropdownMenuItem className="min-h-[44px] touch-target">
                <User className="mr-2 h-4 w-4" />
                {t("header.menu.profile")}
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem
              onClick={openHardwareSetup}
              className="min-h-[44px] touch-target"
            >
              <Printer className="mr-2 h-4 w-4" />
              {t("settings.hardware.label")}
            </DropdownMenuItem>
            {(currentUser?.role === "admin" ||
              currentStore?.ownerId === currentUser?.id ||
              currentUser?.role === "store_admin") && (
              <Link href="/settings">
                <DropdownMenuItem className="min-h-[44px] touch-target">
                  <Store className="mr-2 h-4 w-4" />
                  {t("nav.settings")}
                </DropdownMenuItem>
              </Link>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive min-h-[44px] touch-target"
            >
              {t("header.menu.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

interface NotificationItemProps {
  notification: Notification;
  Icon: React.ElementType;
  colorClass: string;
  dateLocale: Locale;
  onMarkRead: () => void;
  onRemove: () => void;
}

function NotificationItem({
  notification,
  Icon,
  colorClass,
  dateLocale,
  onMarkRead,
  onRemove,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        "relative px-4 py-3 hover:bg-muted/50 transition-colors",
        !notification.read && "bg-muted/30"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm font-medium",
                !notification.read && "font-semibold"
              )}
            >
              {notification.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
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
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(notification.createdAt, {
              addSuffix: true,
              locale: dateLocale,
            })}
          </p>
        </div>
      </div>
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}
    </div>
  );
}
