"use client";

import { useEffect, useRef } from "react";
import { ChevronUp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useStoreCurrency } from "@/hooks/use-store-currency";

type PosMobileCartSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  amountToPay: number;
  children: React.ReactNode;
  className?: string;
};

export function PosMobileCartSheet({
  open,
  onOpenChange,
  itemCount,
  amountToPay,
  children,
  className,
}: PosMobileCartSheetProps) {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const prevItemCountRef = useRef(itemCount);

  useEffect(() => {
    const isMobileLayout = !window.matchMedia("(min-width: 1024px)").matches;
    if (isMobileLayout && prevItemCountRef.current === 0 && itemCount > 0) {
      onOpenChange(true);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount, onOpenChange]);

  const summary = t("pos.cart.sheetSummary", {
    count: itemCount,
    total: formatMoney(amountToPay),
  });

  return (
    <div className={cn("lg:hidden", className)}>
      <button
        type="button"
        data-testid="pos-mobile-cart-bar"
        aria-expanded={open}
        aria-label={t("pos.cart.openSheet")}
        onClick={() => onOpenChange(true)}
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t bg-card px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))] touch-target"
      >
        <span className="text-sm font-semibold truncate">{summary}</span>
        <ChevronUp
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[min(85dvh,100%)] max-h-[85dvh] flex-col gap-0 p-0 [&>button]:top-3"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">{t("pos.cart.openSheet")}</SheetTitle>
          <SheetDescription className="sr-only">{summary}</SheetDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-10">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
