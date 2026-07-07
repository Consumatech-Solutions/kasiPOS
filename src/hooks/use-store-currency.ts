"use client";

import { useCallback, useMemo } from "react";
import { useSettings } from "@/components/settings-provider";
import {
  convertFromUsd,
  convertToUsd,
  getCurrencyConversionLines,
  type CurrencyConversionLine,
} from "@/lib/currency-conversion";
import { formatMoney } from "@/lib/format-money";
import type { StoreCurrency } from "@/types";

export function useStoreCurrency() {
  const { settings } = useSettings();
  const store = settings.currentStore;
  const currency: StoreCurrency = store?.currency ?? "USD";
  const cdfUsdExRate = store?.cdfUsdExRate ?? null;
  const zarUsdExRate = store?.zarUsdExRate ?? null;
  const rates = useMemo(
    () => ({ cdfUsdExRate, zarUsdExRate }),
    [cdfUsdExRate, zarUsdExRate]
  );

  const format = useCallback(
    (amount: number) => formatMoney(amount, currency),
    [currency]
  );

  const getConversionLines = useCallback(
    (amount: number): CurrencyConversionLine[] =>
      getCurrencyConversionLines(amount, currency, rates),
    [currency, rates]
  );

  const convertAmountToUsd = useCallback(
    (amount: number) => convertToUsd(amount, currency, rates),
    [currency, rates]
  );

  const convertUsdAmount = useCallback(
    (amountUsd: number, target: StoreCurrency) =>
      convertFromUsd(amountUsd, target, rates),
    [rates]
  );

  return {
    currency,
    cdfUsdExRate,
    zarUsdExRate,
    formatMoney: format,
    getConversionLines,
    convertAmountToUsd,
    convertUsdAmount,
  };
}
