import { describe, expect, it } from "vitest";
import {
  convertFromUsd,
  convertToUsd,
  getCurrencyConversionLines,
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
