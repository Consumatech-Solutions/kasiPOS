"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavMenuList } from "@/components/layout/nav-menu-list";
import { useSettings } from "@/components/settings-provider";
import { useTranslation } from "react-i18next";

type MobileNavSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNavSheet({ open, onOpenChange }: MobileNavSheetProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { settings } = useSettings();
  const { currentStore } = settings;
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    onOpenChange(false);
    // Close when route changes (back/forward or link navigation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[min(85vw,280px)] max-w-[280px] p-0 flex flex-col"
      >
        <SheetHeader className="border-b px-4 py-4 text-left space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2"
            onClick={() => onOpenChange(false)}
          >
            {!logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo.png"
                alt="kasiPOS"
                className="h-9 w-9 rounded-lg object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="bg-green-500 p-2 rounded-md">
                <Store className="h-4 w-4 text-white" />
              </div>
            )}
            <SheetTitle className="text-lg font-bold m-0">kasiPOS</SheetTitle>
          </Link>
          {currentStore && (
            <p className="text-sm text-muted-foreground truncate font-normal">
              {currentStore.name}
            </p>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <NavMenuList
            variant="vertical"
            onNavigate={() => onOpenChange(false)}
          />
        </ScrollArea>
        <span className="sr-only">{t("header.menu.navigation")}</span>
      </SheetContent>
    </Sheet>
  );
}
