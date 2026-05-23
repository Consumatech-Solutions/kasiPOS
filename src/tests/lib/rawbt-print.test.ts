import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildRawBtIntentUrl,
  encodeRawBtBase64,
  printViaRawBt,
  printViaRawBtIntent,
} from "@/lib/rawbt-print";

describe("rawbt-print", () => {
  describe("encodeRawBtBase64", () => {
    it("encodes ESC/POS bytes as base64", () => {
      const payload = new Uint8Array([0x1b, 0x40, 0x48, 0x69]);
      expect(encodeRawBtBase64(payload)).toBe(btoa("\x1b@Hi"));
    });
  });

  describe("buildRawBtIntentUrl", () => {
    it("builds rawbt intent URL", () => {
      const payload = new Uint8Array([0x1b, 0x40]);
      expect(buildRawBtIntentUrl(payload)).toBe(
        `rawbt:base64,${encodeRawBtBase64(payload)}`
      );
    });
  });

  describe("printViaRawBtIntent", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { href: "" },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("navigates to rawbt intent URL", () => {
      const payload = new Uint8Array([0x1b, 0x40]);
      printViaRawBtIntent(payload);
      expect(window.location.href).toBe(buildRawBtIntentUrl(payload));
    });

    it("printViaRawBt uses intent navigation", async () => {
      const payload = new Uint8Array([0x1b, 0x40]);
      await printViaRawBt(payload);
      expect(window.location.href).toBe(buildRawBtIntentUrl(payload));
    });
  });
});
