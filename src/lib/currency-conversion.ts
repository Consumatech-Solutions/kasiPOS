import { formatMoney } from "@/lib/format-money";
import type { StoreCurrency } from "@/types";

export interface StoreExchangeRates {
  cdfUsdExRate?: number | null;
  zarUsdExRate?: number | null;
}

export interface CurrencyConversionLine {
  currency: StoreCurrency;
  amount: number;
  formatted: string;
}

/** Convert an amount in store currency to USD using configured rates. */
export function convertToUsd(
  amount: number,
  storeCurrency: StoreCurrency,
  rates: StoreExchangeRates
): number | null {
  if (!Number.isFinite(amount)) return null;

  if (storeCurrency === "USD") return amount;

  if (storeCurrency === "CDF") {
    const rate = rates.cdfUsdExRate;
    if (rate == null || rate <= 0) return null;
    return amount / rate;
  }

  if (storeCurrency === "ZAR") {
    const rate = rates.zarUsdExRate;
    if (rate == null || rate <= 0) return null;
    return amount / rate;
  }

  return null;
}

/** Convert a USD amount to another currency using configured rates. */
export function convertFromUsd(
  amountUsd: number,
  targetCurrency: StoreCurrency,
  rates: StoreExchangeRates
): number | null {
  if (!Number.isFinite(amountUsd)) return null;

  if (targetCurrency === "USD") return amountUsd;

  if (targetCurrency === "CDF") {
    const rate = rates.cdfUsdExRate;
    if (rate == null || rate <= 0) return null;
    return amountUsd * rate;
  }

  if (targetCurrency === "ZAR") {
    const rate = rates.zarUsdExRate;
    if (rate == null || rate <= 0) return null;
    return amountUsd * rate;
  }

  return null;
}

/** Reference amounts in other currencies for display at checkout (not used for pricing). */
export function getCurrencyConversionLines(
  amount: number,
  storeCurrency: StoreCurrency,
  rates: StoreExchangeRates
): CurrencyConversionLine[] {
  const lines: CurrencyConversionLine[] = [];

  if (storeCurrency === "CDF") {
    const usd = convertToUsd(amount, "CDF", rates);
    if (usd != null) {
      lines.push({
        currency: "USD",
        amount: usd,
        formatted: formatMoney(usd, "USD"),
      });
    }
    return lines;
  }

  if (storeCurrency === "ZAR") {
    const usd = convertToUsd(amount, "ZAR", rates);
    if (usd != null) {
      lines.push({
        currency: "USD",
        amount: usd,
        formatted: formatMoney(usd, "USD"),
      });
    }
    return lines;
  }

  const cdf = convertFromUsd(amount, "CDF", rates);
  if (cdf != null) {
    lines.push({
      currency: "CDF",
      amount: cdf,
      formatted: formatMoney(cdf, "CDF"),
    });
  }

  const zar = convertFromUsd(amount, "ZAR", rates);
  if (zar != null) {
    lines.push({
      currency: "ZAR",
      amount: zar,
      formatted: formatMoney(zar, "ZAR"),
    });
  }

  return lines;
}
