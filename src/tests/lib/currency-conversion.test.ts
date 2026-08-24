import { describe, expect, it } from "vitest";
import {
  convertCurrency,
  convertFromUsd,
  convertToUsd,
  getCurrencyConversionLines,
  getMissingExchangeRate,
} from "@/lib/currency-conversion";

describe("currency conversion", () => {
  const rates = { cdfUsdExRate: 2850, zarUsdExRate: 18.25 };

  it("converts CDF to USD", () => {
    expect(convertToUsd(2850, "CDF", rates)).toBe(1);
  });

  it("converts ZAR to USD", () => {
    expect(convertToUsd(18.25, "ZAR", rates)).toBe(1);
  });

  it("converts USD to CDF", () => {
    expect(convertFromUsd(1, "CDF", rates)).toBe(2850);
  });

  it("converts between CDF and ZAR via USD", () => {
    expect(convertCurrency(2850, "CDF", "ZAR", rates)).toBe(18.25);
    expect(convertCurrency(18.25, "ZAR", "CDF", rates)).toBe(2850);
  });

  it("returns same amount when currencies match", () => {
    expect(convertCurrency(100, "USD", "USD", rates)).toBe(100);
  });

  it("returns null when a required rate is missing", () => {
    expect(convertCurrency(100, "USD", "CDF", {})).toBeNull();
    expect(convertCurrency(100, "CDF", "USD", { zarUsdExRate: 18 })).toBeNull();
  });

  it("reports missing exchange rate keys", () => {
    expect(getMissingExchangeRate("USD", "USD", {})).toBeNull();
    expect(getMissingExchangeRate("USD", "CDF", {})).toBe("cdfUsdExRate");
    expect(getMissingExchangeRate("ZAR", "USD", {})).toBe("zarUsdExRate");
    expect(getMissingExchangeRate("USD", "CDF", rates)).toBeNull();
  });

  it("returns USD reference line for CDF store currency", () => {
    const lines = getCurrencyConversionLines(2850, "CDF", rates);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.currency).toBe("USD");
    expect(lines[0]?.amount).toBe(1);
  });

  it("returns alternate lines for USD store when rates are set", () => {
    const lines = getCurrencyConversionLines(1, "USD", rates);
    expect(lines.map((line) => line.currency)).toEqual(["CDF", "ZAR"]);
  });

  it("returns empty lines when rate is missing", () => {
    expect(getCurrencyConversionLines(100, "CDF", {})).toEqual([]);
  });
});
