import { describe, it, expect } from "vitest";
import { formatMoney, getCurrencySymbol } from "@/lib/format-money";

describe("formatMoney", () => {
  it("formats USD amounts", () => {
    const result = formatMoney(12.5, "USD");
    expect(result).toMatch(/\$|USD/);
    expect(result).toMatch(/12\.50/);
  });

  it("formats ZAR amounts", () => {
    const result = formatMoney(99.99, "ZAR");
    expect(result).toMatch(/R|ZAR/);
    expect(result).toMatch(/99\.99/);
  });

  it("formats CDF amounts", () => {
    const result = formatMoney(2850, "CDF");
    expect(result).toMatch(/CDF|FC/);
  });

  it("defaults to USD when currency omitted", () => {
    expect(getCurrencySymbol()).toBe("$");
    expect(formatMoney(0)).toMatch(/\$|USD/);
  });

  it("handles non-finite amounts as zero", () => {
    expect(formatMoney(Number.NaN, "USD")).toMatch(/0\.00/);
  });
});
