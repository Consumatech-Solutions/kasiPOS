"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OFFLINE_FIRST_PATHS } from "@/lib/nav-config";
import { Button } from "@/components/ui/button";
import { useEffectiveOnline } from "@/hooks/use-effective-online";
import { useFilteredNavItems } from "@/hooks/use-filtered-nav-items";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type NavMenuListProps = {
  variant: "horizontal" | "vertical";
  onNavigate?: () => void;
};

export function NavMenuList({ variant, onNavigate }: NavMenuListProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const navItems = useFilteredNavItems();
  const { effectiveOnline } = useEffectiveOnline();

  if (variant === "horizontal") {
    return (
      <div className="flex h-full items-center gap-2 min-w-fit px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const offlineFirst = (
            OFFLINE_FIRST_PATHS as readonly string[]
          ).includes(item.href);
          const settingsPath = item.href === "/settings";
          const needsCloud = !offlineFirst && !settingsPath;
          const isGreyed = needsCloud && !effectiveOnline;
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              asChild
              className={cn(
                "flex-col h-full px-4 text-xs whitespace-nowrap flex-shrink-0 rounded-none border-b-2",
                isActive ? "border-destructive" : "border-transparent",
                isGreyed && "opacity-50 pointer-events-none cursor-not-allowed"
              )}
            >
              <Link href={item.href} aria-disabled={isGreyed}>
                <Icon className="w-5 h-5 mb-1" />
                <span>{t(item.labelKey)}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        const offlineFirst = (
          OFFLINE_FIRST_PATHS as readonly string[]
        ).includes(item.href);
        const settingsPath = item.href === "/settings";
        const needsCloud = !offlineFirst && !settingsPath;
        const isGreyed = needsCloud && !effectiveOnline;
        return (
          <Button
            key={item.href}
            variant={isActive ? "secondary" : "ghost"}
            asChild
            className={cn(
              "w-full justify-start gap-3 min-h-[44px] h-auto py-3 px-3 text-sm font-medium",
              isGreyed && "opacity-50 pointer-events-none cursor-not-allowed"
            )}
          >
            <Link
              href={item.href}
              aria-disabled={isGreyed}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate?.()}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
