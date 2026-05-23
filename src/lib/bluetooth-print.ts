import type { ReceiptData } from "@/components/pos/ReceiptModal";

export const BLUETOOTH_PRINT_PACKAGE = "mate.bluetoothprint";

export const BLUETOOTH_PRINT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=mate.bluetoothprint";

/** Conservative limit for Chrome Android intent URL payload size. */
export const BLUETOOTH_PRINT_MAX_STRING_LENGTH = 8000;

export interface TextFormatOptions {
  bold?: 0 | 1;
  align?: 0 | 1 | 2;
  format?: 0 | 1 | 2 | 3;
}

export function formatBluetoothPrintText(
  content: string,
  options: TextFormatOptions = {}
): string {
  const bold = options.bold ?? 0;
  const align = options.align ?? 0;
  const format = options.format ?? 0;
  return `<${bold}${align}${format}>${content}`;
}

export function buildTestPrintString(): string {
  return (
    formatBluetoothPrintText("KasiPOS test", { bold: 1, align: 1, format: 3 }) +
    formatBluetoothPrintText("Printer setup successful", { align: 1 })
  );
}

function formatReceiptDate(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function receiptDataToIntentString(data: ReceiptData): string {
  let str = "";

  str += formatBluetoothPrintText(data.storeName, {
    bold: 1,
    align: 1,
    format: 3,
  });
  str += formatBluetoothPrintText(`Sale ID: ${data.saleId}`);
  str += formatBluetoothPrintText(formatReceiptDate(data.timestamp));
  str += formatBluetoothPrintText("--------------------------------");
  str += formatBluetoothPrintText("Item              Qty    Total");
  str += formatBluetoothPrintText("--------------------------------");

  for (const item of data.items) {
    const name =
      item.productName.length > 18
        ? item.productName.substring(0, 15) + "..."
        : item.productName.padEnd(18);
    const qty = item.quantity.toString().padStart(3);
    const total = `R ${(item.totalPrice ?? 0).toFixed(2)}`.padStart(8);
    str += formatBluetoothPrintText(`${name} ${qty} ${total}`);
  }

  str += formatBluetoothPrintText("--------------------------------");
  str += formatBluetoothPrintText(`Subtotal: R ${data.subtotal.toFixed(2)}`);

  if (data.discountAmount > 0) {
    str += formatBluetoothPrintText(
      `Discount: -R ${data.discountAmount.toFixed(2)}`
    );
  }

  if (data.voucherCode) {
    str += formatBluetoothPrintText(`Voucher: ${data.voucherCode}`);
  }

  if (data.showVat) {
    str += formatBluetoothPrintText(
      `VAT (15%): R ${data.vatAmount.toFixed(2)}`
    );
  }

  str += formatBluetoothPrintText(`Total: R ${data.total.toFixed(2)}`, {
    bold: 1,
  });
  str += formatBluetoothPrintText(`Payment: ${data.paymentMethod}`);
  str += formatBluetoothPrintText("Thank you for your purchase", {
    align: 1,
  });

  return str;
}

export function buildChromeIntentUrl(printString: string): string {
  const encodedText = encodeURIComponent(printString);
  const fallback = encodeURIComponent(BLUETOOTH_PRINT_PLAY_STORE_URL);

  return (
    `intent:#Intent;` +
    `action=android.intent.action.SEND;` +
    `type=text/plain;` +
    `package=${BLUETOOTH_PRINT_PACKAGE};` +
    `S.android.intent.extra.TEXT=${encodedText};` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  );
}

export function launchBluetoothPrint(printString: string): void {
  if (typeof window === "undefined") {
    throw new Error("Bluetooth Print is only available in the browser");
  }

  if (printString.length > BLUETOOTH_PRINT_MAX_STRING_LENGTH) {
    throw new Error(
      "Receipt is too long for Bluetooth Print. Try printing fewer items or use browser print."
    );
  }

  window.location.href = buildChromeIntentUrl(printString);
}
