import { describe, it, expect } from "vitest";
import {
  sanitizeTenderedInput,
  appendTenderedKey,
} from "@/lib/payment-tendered-input";

describe("payment-tendered-input", () => {
  describe("sanitizeTenderedInput", () => {
    it("keeps digits and a single decimal point", () => {
      expect(sanitizeTenderedInput("150.50")).toBe("150.50");
    });

    it("strips currency symbols and spaces", () => {
      expect(sanitizeTenderedInput("R 150.50")).toBe("150.50");
    });

    it("collapses multiple decimal points", () => {
      expect(sanitizeTenderedInput("12.3.4")).toBe("12.34");
    });

    it("returns empty for non-numeric input", () => {
      expect(sanitizeTenderedInput("abc")).toBe("");
    });
  });

  describe("appendTenderedKey", () => {
    it("appends digit keys", () => {
      expect(appendTenderedKey("12", "3")).toBe("123");
    });

    it("allows only one decimal point", () => {
      expect(appendTenderedKey("10", ".")).toBe("10.");
      expect(appendTenderedKey("10.", ".")).toBe("10.");
    });
  });
});
