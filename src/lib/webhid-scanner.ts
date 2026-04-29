export interface WebHIDDevice {
  id: string;
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  name: string;
  connected: boolean;
}

export interface ScanResponse {
  success: boolean;
  data: string;
  deviceId: string;
}

const COMMON_SCANNER_VENDORS = [
  0x05e0, 0x05e1, 0x0c2e, 0x1d90, 0x0acd, 0x1a86,
] as const;

export function isWebHIDAvailable(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export async function getWebHIDScanners(): Promise<WebHIDDevice[]> {
  if (!isWebHIDAvailable()) {
    return [];
  }

  if (!navigator.hid) {
    return [];
  }

  try {
    const devices = await navigator.hid.getDevices();
    return devices
      .filter((device) => {
        return (
          COMMON_SCANNER_VENDORS.includes(device.vendorId as any) ||
          device.collections.some(
            (collection) =>
              collection.usagePage === 0x01 || collection.usagePage === 0x0c,
          )
        );
      })
      .map((device) => ({
        id: `webhid_${device.vendorId}_${device.productId}_${device.serialNumber || "unknown"}`,
        vendorId: device.vendorId,
        productId: device.productId,
        manufacturer: device.manufacturerName,
        product: device.productName,
        serialNumber: device.serialNumber,
        name:
          device.productName ||
          `Scanner (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
        connected: device.opened,
      }));
  } catch (error) {
    console.error("Error getting WebHID devices:", error);
    return [];
  }
}

export async function requestWebHIDScanner(
  filters?: HIDDeviceFilter[],
): Promise<HIDDevice> {
  if (!isWebHIDAvailable() || !navigator.hid) {
    throw new Error("WebHID API is not available in this browser");
  }

  try {
    const device = await navigator.hid.requestDevice({
      filters: filters || [
        ...COMMON_SCANNER_VENDORS.map((vendorId) => ({ vendorId })),
        { usagePage: 0x01, usage: 0x06 },
      ],
    });
    return device[0];
  } catch (error: any) {
    if (error.name === "NotFoundError") {
      throw new Error("No scanner device selected");
    }
    throw new Error(`Failed to request device: ${error.message}`);
  }
}

export async function connectWebHIDScanner(
  vendorId: number,
  productId: number,
  serialNumber?: string,
): Promise<HIDDevice> {
  if (!isWebHIDAvailable() || !navigator.hid) {
    throw new Error("WebHID API is not available in this browser");
  }

  try {
    const devices = await navigator.hid.getDevices();
    const device = devices.find(
      (d) =>
        d.vendorId === vendorId &&
        d.productId === productId &&
        (!serialNumber || d.serialNumber === serialNumber),
    );

    if (!device) {
      throw new Error("Device not found. Please grant permission first.");
    }

    if (!device.opened) {
      await device.open();
    }

    return device;
  } catch (error: any) {
    throw new Error(`Failed to connect to device: ${error.message}`);
  }
}

function parseBarcodeFromReport(data: DataView): string | null {
  if (data.byteLength >= 2) {
    let barcode = "";
    for (let i = 1; i < data.byteLength && i < 7; i++) {
      const keyCode = data.getUint8(i);
      if (keyCode === 0) break;

      if (keyCode >= 0x04 && keyCode <= 0x1d) {
        barcode += String.fromCharCode(0x61 + (keyCode - 0x04));
      } else if (keyCode >= 0x1e && keyCode <= 0x27) {
        barcode += String.fromCharCode(0x31 + (keyCode - 0x1e));
      } else if (keyCode === 0x2c) {
        barcode += " ";
      } else if (keyCode === 0x28) {
        break;
      }
    }

    if (barcode.length > 0) {
      return barcode;
    }
  }

  try {
    const text = new TextDecoder("utf-8").decode(data);
    const cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  } catch {}

  return null;
}

export async function scanBarcodeFromWebHID(
  deviceId: string,
  timeout: number = 5000,
): Promise<ScanResponse> {
  if (!isWebHIDAvailable()) {
    throw new Error("WebHID API is not available in this browser");
  }

  const parts = deviceId.split("_");
  if (parts.length < 3 || parts[0] !== "webhid") {
    throw new Error("Invalid WebHID device ID format");
  }

  const vendorId = parseInt(parts[1], 16);
  const productId = parseInt(parts[2], 16);
  const serialNumber = parts.length > 3 ? parts.slice(3).join("_") : undefined;

  let device: HIDDevice;
  try {
    device = await connectWebHIDScanner(vendorId, productId, serialNumber);
  } catch (error: any) {
    throw new Error(`Failed to connect to scanner: ${error.message}`);
  }

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      device.removeEventListener("inputreport", inputHandler);
      resolved = true;
    };

    const inputHandler = (event: HIDInputReportEvent) => {
      if (resolved) return;

      try {
        const barcode = parseBarcodeFromReport(event.data);
        if (barcode && barcode.length > 0) {
          cleanup();
          resolve({
            success: true,
            data: barcode,
            deviceId,
          });
        }
      } catch (error: any) {
        console.error("Error parsing barcode:", error);
      }
    };

    device.addEventListener("inputreport", inputHandler);

    timeoutId = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error("TIMEOUT"));
      }
    }, timeout);
  });
}

export async function pollWebHIDScanner(
  deviceId: string,
  onProgress?: () => void,
  pollInterval: number = 500,
): Promise<string> {
  const maxAttempts = 200;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const result = await scanBarcodeFromWebHID(deviceId, pollInterval + 100);
      if (result.success && result.data) {
        return result.data;
      }
    } catch (error: any) {
      if (error.message === "TIMEOUT") {
        attempts++;
        if (onProgress) {
          onProgress();
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Scanner polling timeout - no barcode detected");
}

export function parseWebHIDDeviceId(deviceId: string): {
  vendorId: number;
  productId: number;
  serialNumber?: string;
} | null {
  const parts = deviceId.split("_");
  if (parts.length < 3 || parts[0] !== "webhid") {
    return null;
  }

  return {
    vendorId: parseInt(parts[1], 16),
    productId: parseInt(parts[2], 16),
    serialNumber: parts.length > 3 ? parts.slice(3).join("_") : undefined,
  };
}

export function createWebHIDDeviceId(device: HIDDevice): string {
  return `webhid_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || "unknown"}`;
}
