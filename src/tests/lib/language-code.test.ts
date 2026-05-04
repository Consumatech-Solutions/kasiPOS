import { describe, expect, it } from "vitest";
import {
  normalizeToSupportedI18nLng,
  parseStoredAppLanguage,
} from "@/lib/language-code";

describe("normalizeToSupportedI18nLng", () => {
  it("returns fr for fr", () => {
    expect(normalizeToSupportedI18nLng("fr")).toBe("fr");
  });

  it("returns en for en and unsupported codes", () => {
    expect(normalizeToSupportedI18nLng("en")).toBe("en");
    expect(normalizeToSupportedI18nLng("sw")).toBe("en");
    expect(normalizeToSupportedI18nLng("zu")).toBe("en");
    expect(normalizeToSupportedI18nLng("")).toBe("en");
    expect(normalizeToSupportedI18nLng("EN")).toBe("en");
  });
});

describe("parseStoredAppLanguage", () => {
  it("accepts known app language codes", () => {
    expect(parseStoredAppLanguage("en")).toBe("en");
    expect(parseStoredAppLanguage("fr")).toBe("fr");
    expect(parseStoredAppLanguage("sw")).toBe("sw");
  });

  it("falls back to en for invalid input", () => {
    expect(parseStoredAppLanguage(undefined)).toBe("en");
    expect(parseStoredAppLanguage(null)).toBe("en");
    expect(parseStoredAppLanguage("xx")).toBe("en");
    expect(parseStoredAppLanguage(1)).toBe("en");
  });
});
