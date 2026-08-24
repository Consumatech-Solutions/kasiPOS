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

export type ExchangeRateKey = "cdfUsdExRate" | "zarUsdExRate";

function isPositiveRate(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate) && rate > 0;
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
    if (!isPositiveRate(rate)) return null;
    return amount / rate;
  }

  if (storeCurrency === "ZAR") {
    const rate = rates.zarUsdExRate;
    if (!isPositiveRate(rate)) return null;
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
    if (!isPositiveRate(rate)) return null;
    return amountUsd * rate;
  }

  if (targetCurrency === "ZAR") {
    const rate = rates.zarUsdExRate;
    if (!isPositiveRate(rate)) return null;
    return amountUsd * rate;
  }

  return null;
}

/**
 * Convert an amount between any two supported currencies via USD.
 * Returns null when a required exchange rate is missing.
 */
export function convertCurrency(
  amount: number,
  from: StoreCurrency,
  to: StoreCurrency,
  rates: StoreExchangeRates
): number | null {
  if (from === to) {
    return Number.isFinite(amount) ? amount : null;
  }
  const usd = convertToUsd(amount, from, rates);
  if (usd == null) return null;
  return convertFromUsd(usd, to, rates);
}

/**
 * Which rate must be configured to convert between `from` and `to`.
 * Returns null when no rate is needed or all required rates are present.
 */
export function getMissingExchangeRate(
  from: StoreCurrency,
  to: StoreCurrency,
  rates: StoreExchangeRates
): ExchangeRateKey | null {
  if (from === to) return null;

  const needed = new Set<StoreCurrency>();
  if (from !== "USD") needed.add(from);
  if (to !== "USD") needed.add(to);

  if (needed.has("CDF") && !isPositiveRate(rates.cdfUsdExRate)) {
    return "cdfUsdExRate";
  }
  if (needed.has("ZAR") && !isPositiveRate(rates.zarUsdExRate)) {
    return "zarUsdExRate";
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
