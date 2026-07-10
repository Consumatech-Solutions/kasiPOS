"use client";

import { useStoreCurrency } from "@/hooks/use-store-currency";
import { getCurrencyConversionLines } from "@/lib/currency-conversion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface CurrencyConversionHintProps {
  amount: number;
  className?: string;
}

export function CurrencyConversionHint({
  amount,
  className,
}: CurrencyConversionHintProps) {
  const { t } = useTranslation();
  const { currency, cdfUsdExRate, zarUsdExRate } = useStoreCurrency();
  const lines = getCurrencyConversionLines(amount, currency, {
    cdfUsdExRate,
    zarUsdExRate,
  });

  if (lines.length === 0) return null;

  return (
    <div className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      {lines.map((line) => (
        <p key={line.currency}>
          {t("pos.currencyConversion.approx", {
            amount: line.formatted,
          })}
        </p>
      ))}
    </div>
  );
}
