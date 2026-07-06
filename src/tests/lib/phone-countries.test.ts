import { describe, expect, it } from "vitest";
import {
  formatE164,
  getPhoneCountry,
  isSouthAfrica,
  normalizeLocalNumber,
  validateLocalNumber,
} from "@/lib/phone-countries";

describe("formatE164", () => {
  it("combines SA dial code and local number, stripping leading zero", () => {
    expect(formatE164("27", "0812345678", "ZA")).toBe("27812345678");
    expect(formatE164("27", "812345678", "ZA")).toBe("27812345678");
  });

  it("combines non-SA dial codes", () => {
    expect(formatE164("44", "7911123456", "GB")).toBe("447911123456");
  });
});

describe("validateLocalNumber", () => {
  it("accepts valid SA numbers (9 digits after stripping 0)", () => {
    const result = validateLocalNumber("ZA", "0812345678");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalized).toBe("812345678");
    }
  });

  it("rejects SA numbers that are too short", () => {
    const result = validateLocalNumber("ZA", "08123");
    expect(result.valid).toBe(false);
  });

  it("rejects empty numbers", () => {
    const result = validateLocalNumber("ZA", "");
    expect(result.valid).toBe(false);
  });
});

describe("getPhoneCountry", () => {
  it("returns ZA as default country entry", () => {
    expect(getPhoneCountry("ZA")?.dialCode).toBe("27");
    expect(getPhoneCountry("ZA")?.flag).toBe("🇿🇦");
  });

  it("returns undefined for unknown ISO", () => {
    expect(getPhoneCountry("XX")).toBeUndefined();
  });
});

describe("normalizeLocalNumber", () => {
  it("strips non-digits and leading zero", () => {
    expect(normalizeLocalNumber("ZA", "081-234-5678")).toBe("812345678");
  });
});

describe("isSouthAfrica", () => {
  it("detects ZA case-insensitively", () => {
    expect(isSouthAfrica("ZA")).toBe(true);
    expect(isSouthAfrica("za")).toBe(true);
    expect(isSouthAfrica("GB")).toBe(false);
  });
});
