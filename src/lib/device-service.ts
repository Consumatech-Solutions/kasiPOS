import {
  getWebUSBPrinters,
  printToWebUSB,
  isWebUSBAvailable,
} from "./webusb-printer";
import {
  getWebHIDScanners,
  scanBarcodeFromWebHID,
  pollWebHIDScanner,
  isWebHIDAvailable,
} from "./webhid-scanner";
import { getQzPrinters, printViaQz } from "./qz-tray";
import { isAndroid } from "./platform";

const PRINTER_SERVER_URL = "http://localhost:7788";

export interface Device {
  id: string;
  type: "printer" | "scanner" | "pos";
  connection: "usb" | "bluetooth" | "serial";
  connectionType: "webusb" | "webhid" | "server" | "qz";
  name: string;
  vendorId?: number;
  productId?: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  path?: string;
  address?: string;
  connected: boolean;
}

export interface DevicesResponse {
  success: boolean;
  devices: Device[];
}

export interface PrintResponse {
  success: boolean;
  message: string;
  deviceId?: string;
}

export interface ScanResponse {
  success: boolean;
  data: string;
  deviceId: string;
}

export interface PosResponse {
  success: boolean;
  response: string;
  deviceId: string;
}

const STORAGE_KEYS = {
  printer: "kasiPOS_printerDeviceId",
  scanner: "kasiPOS_scannerDeviceId",
  pos: "kasiPOS_posDeviceId",
} as const;

const CONNECTION_TYPE_KEY = "kasiPOS_deviceConnectionType";
const PRINTER_MODE_KEY = "kasiPOS_printerMode";

export type PrinterMode = "thermal" | "browser";

export function getPrinterMode(): PrinterMode {
  if (typeof window === "undefined") return "thermal";
  const stored = localStorage.getItem(PRINTER_MODE_KEY);
  if (stored === "thermal" || stored === "browser") return stored;
  return "thermal";
}

export function setPrinterMode(mode: PrinterMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRINTER_MODE_KEY, mode);
}

export function buildTestPrintPayload(): Uint8Array {
  // ESC @ = Initialize printer
  // ESC a 1 = Center alignment
  // "KasiPOS test\n"
  // ESC a 0 = Left alignment
  // GS V 0 = Full cut
  const text = "KasiPOS test\n";
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const init = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const cut = new Uint8Array([0x1d, 0x56, 0x00]);
  const out = new Uint8Array(
    init.length + center.length + textBytes.length + left.length + cut.length,
  );
  let off = 0;
  out.set(init, off);
  off += init.length;
  out.set(center, off);
  off += center.length;
  out.set(textBytes, off);
  off += textBytes.length;
  out.set(left, off);
  off += left.length;
  out.set(cut, off);
  return out;
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/devices`, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getDevices(
  type?: "printer" | "scanner" | "pos",
): Promise<Device[]> {
  const devices: Device[] = [];

  if ((!type || type === "printer" || type === "pos") && isWebUSBAvailable()) {
    try {
      const webusbDevices = await getWebUSBPrinters();
      devices.push(
        ...webusbDevices.map((d) => ({
          id: d.id,
          type: "printer" as const,
          connection: "usb" as const,
          connectionType: "webusb" as const,
          name: d.name,
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturer,
          product: d.product,
          serialNumber: d.serialNumber,
          connected: d.connected,
        })),
      );
    } catch (error) {
      console.error("Error getting WebUSB printers:", error);
    }
  }

  if ((!type || type === "scanner") && isWebHIDAvailable()) {
    try {
      const webhidDevices = await getWebHIDScanners();
      devices.push(
        ...webhidDevices.map((d) => ({
          id: d.id,
          type: "scanner" as const,
          connection: "usb" as const,
          connectionType: "webhid" as const,
          name: d.name,
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturer,
          product: d.product,
          serialNumber: d.serialNumber,
          connected: d.connected,
        })),
      );
    } catch (error) {
      console.error("Error getting WebHID scanners:", error);
    }
  }

  const isHealthy = await checkServerHealth();
  if (isHealthy) {
    try {
      const url = type
        ? `${PRINTER_SERVER_URL}/devices/${type}`
        : `${PRINTER_SERVER_URL}/devices`;

      const response = await fetch(url);

      if (response.ok) {
        const data: DevicesResponse = await response.json();
        const serverDevices = (data.devices || []).map((d) => ({
          ...d,
          connectionType: "server" as const,
        }));
        devices.push(...serverDevices);
      }
    } catch (error: any) {
      if (devices.length === 0) {
        if (
          error.name === "AbortError" ||
          error.message.includes("Failed to fetch")
        ) {
          throw new Error(
            "Cannot connect to printer server. Make sure it is running on localhost:7788",
          );
        }
        throw error;
      }
    }
  } else if (devices.length === 0) {
    throw new Error(
      "No devices available. WebUSB/WebHID not supported or printer server not running.",
    );
  }

  let filteredDevices = devices;
  if (type) {
    filteredDevices = devices.filter((d) => {
      if (type === "pos") {
        return d.type === "printer" || d.type === "pos";
      }
      return d.type === type;
    });
  }

  const priorityOrder: Record<string, number> = {
    webusb: 1,
    webhid: 2,
    server: 3,
  };

  return filteredDevices.sort((a, b) => {
    const aPriority = priorityOrder[a.connectionType || "server"] || 3;
    const bPriority = priorityOrder[b.connectionType || "server"] || 3;
    return aPriority - bPriority;
  });
}

export async function getQzDevices(): Promise<Device[]> {
  const printers = await getQzPrinters();
  return printers.map((p) => ({
    id: p.id,
    type: "printer" as const,
    connection: "serial" as const,
    connectionType: "qz" as const,
    name: p.name,
    connected: false,
  }));
}

export async function printReceipt(
  deviceId: string,
  data: Uint8Array,
): Promise<PrintResponse> {
  if (deviceId.startsWith("webusb_")) {
    if (!isWebUSBAvailable()) {
      throw new Error("WebUSB API is not available in this browser");
    }
    return await printToWebUSB(deviceId, data);
  }

  if (deviceId.startsWith("qz_")) {
    await printViaQz(deviceId, data);
    return { success: true, message: "Printed via QZ Tray" };
  }

  if (deviceId === "thermal-android") {
    if (!isAndroid()) {
      throw new Error(
        "Android thermal printing is only available on Android devices",
      );
    }
    const base64 = btoa(String.fromCharCode(...data));
    const intentUrl = `rawbt:base64,${base64}`;
    window.location.href = intentUrl;
    return { success: true, message: "Printed via RawBT" };
  }

  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        data: Array.from(data),
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Print failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Cannot connect to printer server. Make sure it is running on localhost:7788",
      );
    }
    throw error;
  }
}

export async function scanBarcode(
  deviceId: string,
  timeout: number = 5000,
): Promise<ScanResponse> {
  if (deviceId.startsWith("webhid_")) {
    if (!isWebHIDAvailable()) {
      throw new Error("WebHID API is not available in this browser");
    }
    return await scanBarcodeFromWebHID(deviceId, timeout);
  }

  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        action: "read",
        timeout,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      if (response.status === 408) {
        throw new Error("TIMEOUT");
      }
      throw new Error(error.error || `Scan failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === "TIMEOUT") {
      throw error;
    }
    if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Cannot connect to printer server. Make sure it is running on localhost:7788",
      );
    }
    throw error;
  }
}

export async function pollScanner(
  deviceId: string,
  onProgress?: () => void,
  pollInterval: number = 500,
): Promise<string> {
  if (deviceId.startsWith("webhid_")) {
    if (!isWebHIDAvailable()) {
      throw new Error("WebHID API is not available in this browser");
    }
    return await pollWebHIDScanner(deviceId, onProgress, pollInterval);
  }

  const maxAttempts = 200;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const result = await scanBarcode(deviceId, pollInterval + 100);
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

export async function connectPos(
  deviceId: string,
  command?: string,
): Promise<PosResponse> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/pos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        command: command || "",
        timeout: 5000,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(
        error.error || `POS connection failed: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Cannot connect to printer server. Make sure it is running on localhost:7788",
      );
    }
    throw error;
  }
}

export function getStoredDevice(
  type: "printer" | "scanner" | "pos",
): string | null {
  if (typeof window === "undefined") return null;
  const key = STORAGE_KEYS[type];
  return localStorage.getItem(key);
}

export function getStoredDeviceConnectionType(
  type: "printer" | "scanner" | "pos",
): "webusb" | "webhid" | "server" | "qz" | null {
  if (typeof window === "undefined") return null;
  const key = `${CONNECTION_TYPE_KEY}_${type}`;
  const stored = localStorage.getItem(key);
  if (
    stored === "webusb" ||
    stored === "webhid" ||
    stored === "server" ||
    stored === "qz"
  ) {
    return stored;
  }
  const deviceId = getStoredDevice(type);
  if (deviceId?.startsWith("webusb_")) return "webusb";
  if (deviceId?.startsWith("webhid_")) return "webhid";
  if (deviceId?.startsWith("qz_")) return "qz";
  return "server";
}

export function storeDevice(
  type: "printer" | "scanner" | "pos",
  deviceId: string,
  connectionType?: "webusb" | "webhid" | "server" | "qz",
): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEYS[type];
  localStorage.setItem(key, deviceId);

  if (connectionType) {
    const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
    localStorage.setItem(typeKey, connectionType);
  } else {
    if (deviceId.startsWith("webusb_")) {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, "webusb");
    } else if (deviceId.startsWith("webhid_")) {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, "webhid");
    } else if (deviceId.startsWith("qz_")) {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, "qz");
    } else {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, "server");
    }
  }
}

export function clearStoredDevice(type: "printer" | "scanner" | "pos"): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEYS[type];
  localStorage.removeItem(key);
  const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
  localStorage.removeItem(typeKey);
  if (type === "printer") {
    localStorage.removeItem(PRINTER_MODE_KEY);
  }
}
