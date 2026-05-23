import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatBluetoothPrintText,
  buildTestPrintString,
  receiptDataToIntentString,
  buildChromeIntentUrl,
  launchBluetoothPrint,
  BLUETOOTH_PRINT_PACKAGE,
  BLUETOOTH_PRINT_MAX_STRING_LENGTH,
} from "@/lib/bluetooth-print";
import { buildReceiptData } from "@/lib/receipt-utils";

describe("bluetooth-print", () => {
  describe("formatBluetoothPrintText", () => {
    it("builds tagged text with default formatting", () => {
      expect(formatBluetoothPrintText("Hello")).toBe("<000>Hello");
    });

    it("builds tagged text with bold, align, and format", () => {
      expect(
        formatBluetoothPrintText("Title", { bold: 1, align: 1, format: 3 })
      ).toBe("<113>Title");
    });
  });

  describe("buildTestPrintString", () => {
    it("returns a non-empty test print string", () => {
      const result = buildTestPrintString();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("KasiPOS test");
      expect(result).toContain("Printer setup successful");
    });
  });

  describe("receiptDataToIntentString", () => {
    it("includes store name, items, and totals", () => {
      const data = buildReceiptData({
        storeName: "Test Store",
        saleId: "TXN-123",
        items: [
          {
            productId: "p1",
            productName: "Product A",
            quantity: 2,
            unitPrice: 10,
            totalPrice: 20,
          },
        ],
        subtotal: 20,
        discountAmount: 0,
        total: 20,
        paymentMethod: "Cash",
        showVat: false,
      });

      const result = receiptDataToIntentString(data);
      expect(result).toContain("<113>Test Store");
      expect(result).toContain("Sale ID: TXN-123");
      expect(result).toContain("Product A");
      expect(result).toContain("Total: R 20.00");
      expect(result).toContain("Payment: Cash");
    });
  });

  describe("buildChromeIntentUrl", () => {
    it("builds a Chrome intent URL for Bluetooth Print", () => {
      const url = buildChromeIntentUrl("<100>Hello");
      expect(url).toMatch(/^intent:#Intent;/);
      expect(url).toContain("action=android.intent.action.SEND");
      expect(url).toContain(`package=${BLUETOOTH_PRINT_PACKAGE}`);
      expect(url).toContain("S.android.intent.extra.TEXT=");
      expect(url).toContain("S.browser_fallback_url=");
      expect(url).toMatch(/end$/);
    });
  });

  describe("launchBluetoothPrint", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { href: "" },
      });
    });

    it("sets window.location.href to the intent URL", () => {
      launchBluetoothPrint("<100>Hello");
      expect(window.location.href).toContain("intent:#Intent;");
    });

    it("throws when print string exceeds max length", () => {
      const longString = "x".repeat(BLUETOOTH_PRINT_MAX_STRING_LENGTH + 1);
      expect(() => launchBluetoothPrint(longString)).toThrow(
        "Receipt is too long for Bluetooth Print"
      );
    });
  });
});
