import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildBackendProxyRewrites,
  getBackendOrigin,
  getConfiguredApiUrl,
} from "@/lib/api/resolve-api-base-url";

describe("getBackendOrigin", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("uses localhost in development even when NEXT_PUBLIC_API_URL is remote", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_API_URL = "https://staging.kasipos.africa";
    delete process.env.BACKEND_PROXY_TARGET;

    expect(getBackendOrigin()).toBe("http://localhost:3001");
    expect(getConfiguredApiUrl()).toBe("https://staging.kasipos.africa");
  });

  it("respects BACKEND_PROXY_TARGET in development", () => {
    process.env.NODE_ENV = "development";
    process.env.BACKEND_PROXY_TARGET = "https://staging.kasipos.africa";

    expect(getBackendOrigin()).toBe("https://staging.kasipos.africa");
  });
});

describe("buildBackendProxyRewrites", () => {
  it("includes an exact rewrite for clear-credit before /transactions", () => {
    const rewrites = buildBackendProxyRewrites();
    const clearCredit = rewrites.find(
      (r) => r.source === "/transactions/clear-credit"
    );
    expect(clearCredit).toEqual({
      source: "/transactions/clear-credit",
      destination: expect.stringContaining("/transactions/clear-credit"),
    });
  });
});
