import type { StoreCurrency } from "@/types";

const CURRENCY_META: Record<
  StoreCurrency,
  { locale: string; symbol: string; code: string }
> = {
  USD: { locale: "en-US", symbol: "$", code: "USD" },
  CDF: { locale: "fr-CD", symbol: "FC", code: "CDF" },
  ZAR: { locale: "en-ZA", symbol: "R", code: "ZAR" },
};

export function getCurrencySymbol(currency: StoreCurrency = "USD"): string {
  return (CURRENCY_META[currency] ?? CURRENCY_META.USD).symbol;
}

export function formatMoney(
  amount: number,
  currency: StoreCurrency = "USD",
  opts?: { style?: "symbol" | "code"; minimumFractionDigits?: number }
): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  const value = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: opts?.minimumFractionDigits ?? 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const prefix = opts?.style === "code" ? meta.code : meta.symbol;
    return `${prefix} ${value.toFixed(2)}`;
  }
}
