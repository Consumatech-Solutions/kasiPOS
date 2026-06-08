import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getJwtExpiryMs,
  isAuthEndpoint,
  isAccessTokenInvalidForSession,
  isJwtFormat,
  clearAuthSessionStorage,
  registerSessionExpiredHandler,
  notifySessionExpired,
  resetSessionExpiredNotifyGuard,
} from "@/lib/auth-session";

function makeJwt(expSeconds: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    "base64url"
  );
  return `${header}.${payload}.signature`;
}

describe("auth-session", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSessionExpiredNotifyGuard();
    registerSessionExpiredHandler(null);
  });

  afterEach(() => {
    registerSessionExpiredHandler(null);
    resetSessionExpiredNotifyGuard();
  });

  describe("getJwtExpiryMs", () => {
    it("returns exp in milliseconds for a valid JWT", () => {
      const expSeconds = 1_700_000_000;
      const token = makeJwt(expSeconds);
      expect(getJwtExpiryMs(token)).toBe(expSeconds * 1000);
    });

    it("returns null for non-JWT strings", () => {
      expect(getJwtExpiryMs("kasi-pos-e2e-local-auth-stub")).toBeNull();
      expect(getJwtExpiryMs("not.a.jwt.without-exp")).toBeNull();
    });

    it("returns null for empty token", () => {
      expect(getJwtExpiryMs("")).toBeNull();
    });
  });

  describe("isAuthEndpoint", () => {
    it("matches auth routes", () => {
      expect(isAuthEndpoint("/auth/login")).toBe(true);
      expect(isAuthEndpoint("/auth/request-otp")).toBe(true);
      expect(isAuthEndpoint("http://localhost:9002/auth/verify-otp")).toBe(
        true
      );
    });

    it("does not match protected routes", () => {
      expect(isAuthEndpoint("/products")).toBe(false);
      expect(isAuthEndpoint("/auth/profile")).toBe(false);
    });
  });

  describe("clearAuthSessionStorage", () => {
    it("removes token and user while keeping theme in settings", () => {
      localStorage.setItem("token", "abc");
      localStorage.setItem("user", "{}");
      localStorage.setItem(
        "kasi-pos-settings",
        JSON.stringify({ theme: "dark", currentUser: { id: "1" } })
      );

      clearAuthSessionStorage("dark");

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(JSON.parse(localStorage.getItem("kasi-pos-settings")!)).toEqual({
        theme: "dark",
      });
    });
  });

  describe("isAccessTokenInvalidForSession", () => {
    it("returns true for expired JWT", () => {
      const token = makeJwt(Math.floor(Date.now() / 1000) - 60);
      expect(isAccessTokenInvalidForSession(token)).toBe(true);
    });

    it("returns false for valid future JWT", () => {
      const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
      expect(isAccessTokenInvalidForSession(token)).toBe(false);
    });

    it("returns true for non-JWT token outside e2e bypass", () => {
      expect(
        isAccessTokenInvalidForSession("kasi-pos-e2e-local-auth-stub")
      ).toBe(true);
    });

    it("returns false for non-JWT token when e2e bypass is active", () => {
      localStorage.setItem("__kasi_pos_e2e", "1");
      expect(
        isAccessTokenInvalidForSession("kasi-pos-e2e-local-auth-stub")
      ).toBe(false);
    });
  });

  describe("isJwtFormat", () => {
    it("detects three-part JWT strings", () => {
      expect(isJwtFormat(makeJwt(1_700_000_000))).toBe(true);
      expect(isJwtFormat("not-a-jwt")).toBe(false);
    });
  });

  describe("notifySessionExpired", () => {
    it("invokes registered handler once when token exists", () => {
      const handler = vi.fn();
      registerSessionExpiredHandler(handler);
      localStorage.setItem("token", makeJwt(1_700_000_000));

      notifySessionExpired();
      notifySessionExpired();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not invoke handler when no token is stored", () => {
      const handler = vi.fn();
      registerSessionExpiredHandler(handler);

      notifySessionExpired();

      expect(handler).not.toHaveBeenCalled();
    });

    it("clears session when no handler is registered", () => {
      localStorage.setItem("token", makeJwt(1_700_000_000));
      localStorage.setItem("user", "{}");

      notifySessionExpired();

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });
});
