
'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Store, 
  User, 
  Bell, 
  Wifi, 
  ChevronDown, 
  Home, 
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
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '../settings-provider';
import { useNotifications, type Notification, type NotificationType } from '@/hooks/use-notifications';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Page title mapping
const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/catalogue': 'Catalogue',
  '/inventory': 'Inventory',
  '/transactions': 'Orders',
  '/customers': 'Customers',
  '/buy-stock': 'Buy Stock',
  '/vouchers': 'Campaigns',
  '/marketplace': 'Marketplace',
  '/boph': 'BOPH',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

const pageIcons: Record<string, React.ElementType> = {
  '/': Home,
  '/catalogue': BookOpen,
  '/inventory': LayoutGrid,
  '/transactions': ScrollText,
  '/customers': Users,
  '/buy-stock': ShoppingCart,
  '/vouchers': Ticket,
  '/marketplace': ShoppingBasket,
  '/boph': PackageCheck,
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return CheckCircle;
    case 'warning':
      return AlertTriangle;
    case 'error':
      return AlertCircle;
    default:
      return Info;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
};

export default function Header() {
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
  const { isOnline, wasOffline } = useNetworkStatus();

  // Get current page title
  const currentPageTitle = useMemo(() => {
    // Check exact match first
    if (pageTitles[pathname]) {
      return pageTitles[pathname];
    }
    // Check for dynamic routes (e.g., /marketplace/[storeId])
    if (pathname.startsWith('/marketplace/')) {
      return 'Marketplace Store';
    }
    return 'Dashboard';
  }, [pathname]);

  const PageIcon = pageIcons[pathname] || Store;

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
      {/* Left Section: Logo and Page Title */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <Link href="/" className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
          <span className="text-base sm:text-lg font-bold hidden sm:inline">kasiPOS</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-2 text-muted-foreground">
          <div className="h-6 w-px bg-border" />
          <PageIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{currentPageTitle}</span>
        </div>

        {/* Store Name */}
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

      {/* Right Section: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Network Status Indicator */}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 sm:h-10 sm:w-10 touch-target"
            title={isOnline ? 'Online' : 'Offline - Working in offline mode'}
          >
            <Wifi className={cn(
              "h-4 w-4 sm:h-5 sm:w-5",
              isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )} />
          </Button>
          {wasOffline && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 animate-pulse">
              Back online - Syncing...
            </div>
          )}
        </div>
        
        {/* Notifications */}
        <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10 touch-target">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 hover:bg-red-600"
                  variant="destructive"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[90vw] sm:w-80 p-0" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
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
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You're all caught up!
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
                          onMarkRead={() => markAsRead(notification.id)}
                          onRemove={() => removeNotification(notification.id)}
                        />
                      </Link>
                    ) : (
                      <NotificationItem
                        notification={notification}
                        Icon={Icon}
                        colorClass={colorClass}
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

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full touch-target">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {currentUser?.name 
                    ? currentUser.name
                        .split(' ')
                        .map(n => n.charAt(0))
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : <User className="h-4 w-4" />
                  }
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 sm:w-56 p-2" align="end" sideOffset={8} alignOffset={-4} collisionPadding={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.name || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.phone || 'No phone'}
                </p>
                {currentUser?.role && (
                  <Badge variant="secondary" className="w-fit mt-1 text-[10px] px-1.5 py-0">
                    {currentUser.role}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/profile">
              <DropdownMenuItem className="min-h-[44px] touch-target">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </Link>
            {currentUser?.role === 'admin' && (
              <Link href="/settings">
                <DropdownMenuItem className="min-h-[44px] touch-target">
                  <Store className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </Link>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive min-h-[44px] touch-target">
              Log out
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
  onMarkRead: () => void;
  onRemove: () => void;
}

function NotificationItem({
  notification,
  Icon,
  colorClass,
  onMarkRead,
  onRemove,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        'relative px-4 py-3 hover:bg-muted/50 transition-colors',
        !notification.read && 'bg-muted/30'
      )}
    >
      <div className="flex gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium', !notification.read && 'font-semibold')}>
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
            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}
    </div>
  );
}
