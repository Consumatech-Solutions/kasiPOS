"use client";

import { useCallback } from "react";
import { useSettings } from "@/components/settings-provider";
import { formatMoney } from "@/lib/format-money";
import type { StoreCurrency } from "@/types";

export function useStoreCurrency() {
  const { settings } = useSettings();
  const store = settings.currentStore;
  const currency: StoreCurrency = store?.currency ?? "USD";
  const cdfUsdExRate = store?.cdfUsdExRate ?? null;
  const zarUsdExRate = store?.zarUsdExRate ?? null;

  const format = useCallback(
    (amount: number) => formatMoney(amount, currency),
    [currency]
  );

  return { currency, cdfUsdExRate, zarUsdExRate, formatMoney: format };
}
