/**
 * WebHID Scanner Service
 * Handles WebHID communication with barcode scanners
 */

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

// Common barcode scanner vendor IDs
const COMMON_SCANNER_VENDORS = [
  0x05e0, // Symbol Technologies (Zebra)
  0x05e1, // Symbol Technologies
  0x0c2e, // Honeywell
  0x1d90, // Datalogic
  0x0acd, // Socket Mobile
  0x1a86, // QinHeng Electronics (some scanners)
] as const;

/**
 * Check if WebHID API is available
 */
export function isWebHIDAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

/**
 * Get connected WebHID scanner devices
 */
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
        // Filter for devices that might be scanners
        // Many scanners use keyboard HID or have specific vendor IDs
        return (
          COMMON_SCANNER_VENDORS.includes(device.vendorId as any) ||
          // Check if device has keyboard-like characteristics
          device.collections.some(
            (collection) =>
              collection.usagePage === 0x01 || // Generic Desktop
              collection.usagePage === 0x0c // Consumer
          )
        );
      })
      .map((device) => ({
        id: `webhid_${device.vendorId}_${device.productId}_${device.serialNumber || 'unknown'}`,
        vendorId: device.vendorId,
        productId: device.productId,
        manufacturer: device.manufacturerName,
        product: device.productName,
        serialNumber: device.serialNumber,
        name: device.productName || `Scanner (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
        connected: device.opened,
      }));
  } catch (error) {
    console.error('Error getting WebHID devices:', error);
    return [];
  }
}

/**
 * Request access to a WebHID scanner device
 */
export async function requestWebHIDScanner(
  filters?: HIDDeviceFilter[]
): Promise<HIDDevice> {
  if (!isWebHIDAvailable() || !navigator.hid) {
    throw new Error('WebHID API is not available in this browser');
  }

  try {
    const device = await navigator.hid.requestDevice({
      filters: filters || [
        // Default filters for common scanner vendors
        ...COMMON_SCANNER_VENDORS.map((vendorId) => ({ vendorId })),
        // Also allow keyboard-like devices (many scanners emulate keyboards)
        { usagePage: 0x01, usage: 0x06 }, // Keyboard
      ],
    });
    return device[0]; // requestDevice returns an array
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      throw new Error('No scanner device selected');
    }
    throw new Error(`Failed to request device: ${error.message}`);
  }
}

/**
 * Connect to a WebHID scanner device by vendor/product ID
 */
export async function connectWebHIDScanner(
  vendorId: number,
  productId: number,
  serialNumber?: string
): Promise<HIDDevice> {
  if (!isWebHIDAvailable() || !navigator.hid) {
    throw new Error('WebHID API is not available in this browser');
  }

  try {
    const devices = await navigator.hid.getDevices();
    const device = devices.find(
      (d) =>
        d.vendorId === vendorId &&
        d.productId === productId &&
        (!serialNumber || d.serialNumber === serialNumber)
    );

    if (!device) {
      throw new Error('Device not found. Please grant permission first.');
    }

    if (!device.opened) {
      await device.open();
    }

    return device;
  } catch (error: any) {
    throw new Error(`Failed to connect to device: ${error.message}`);
  }
}

/**
 * Find input report collection for barcode data
 */
function findInputReportCollection(device: HIDDevice): HIDCollection | null {
  // Look for keyboard-like collections first
  for (const collection of device.collections) {
    if (collection.usagePage === 0x01) {
      // Generic Desktop - often used by scanners
      return collection;
    }
  }

  // Fallback to first collection with input reports
  for (const collection of device.collections) {
    if (collection.inputReports && collection.inputReports.length > 0) {
      return collection;
    }
  }

  return device.collections[0] || null;
}

/**
 * Parse barcode from HID input report
 * Many scanners send data as keyboard input (usage page 0x01)
 */
function parseBarcodeFromReport(data: DataView): string | null {
  // Try to parse as keyboard input (usage page 0x01)
  // Keyboard reports typically have modifier byte + 6 key codes
  if (data.byteLength >= 2) {
    // Check if this looks like keyboard input
    const firstByte = data.getUint8(0);
    
    // Skip modifier byte (first byte) and try to decode key codes
    let barcode = '';
    for (let i = 1; i < data.byteLength && i < 7; i++) {
      const keyCode = data.getUint8(i);
      if (keyCode === 0) break; // End of key codes
      
      // Map key codes to characters (simplified - real implementation would need full HID keycode table)
      // For now, we'll try to extract printable characters
      if (keyCode >= 0x04 && keyCode <= 0x1d) {
        // Letters a-z
        barcode += String.fromCharCode(0x61 + (keyCode - 0x04));
      } else if (keyCode >= 0x1e && keyCode <= 0x27) {
        // Numbers 1-0
        barcode += String.fromCharCode(0x31 + (keyCode - 0x1e));
      } else if (keyCode === 0x2c) {
        barcode += ' ';
      } else if (keyCode === 0x28) {
        // Enter key - end of barcode
        break;
      }
    }
    
    if (barcode.length > 0) {
      return barcode;
    }
  }

  // Fallback: try to decode as ASCII/UTF-8
  try {
    const text = new TextDecoder('utf-8').decode(data);
    // Remove non-printable characters except newline/enter
    const cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  } catch {
    // Not valid UTF-8
  }

  return null;
}

/**
 * Scan barcode from a WebHID scanner device (single read with timeout)
 */
export async function scanBarcodeFromWebHID(
  deviceId: string,
  timeout: number = 5000
): Promise<ScanResponse> {
  if (!isWebHIDAvailable()) {
    throw new Error('WebHID API is not available in this browser');
  }

  // Parse device ID: webhid_vendorId_productId_serialNumber
  const parts = deviceId.split('_');
  if (parts.length < 3 || parts[0] !== 'webhid') {
    throw new Error('Invalid WebHID device ID format');
  }

  const vendorId = parseInt(parts[1], 16);
  const productId = parseInt(parts[2], 16);
  const serialNumber = parts.length > 3 ? parts.slice(3).join('_') : undefined;

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
      device.removeEventListener('inputreport', inputHandler);
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
        // Continue listening
        console.error('Error parsing barcode:', error);
      }
    };

    device.addEventListener('inputreport', inputHandler);

    timeoutId = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('TIMEOUT'));
      }
    }, timeout);
  });
}

/**
 * Poll WebHID scanner device continuously until a barcode is read
 */
export async function pollWebHIDScanner(
  deviceId: string,
  onProgress?: () => void,
  pollInterval: number = 500
): Promise<string> {
  const maxAttempts = 200; // 200 attempts * 500ms = 100 seconds max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const result = await scanBarcodeFromWebHID(deviceId, pollInterval + 100);
      if (result.success && result.data) {
        return result.data;
      }
    } catch (error: any) {
      if (error.message === 'TIMEOUT') {
        // Timeout is expected, continue polling
        attempts++;
        if (onProgress) {
          onProgress();
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }
      // Other errors should be thrown
      throw error;
    }
  }

  throw new Error('Scanner polling timeout - no barcode detected');
}

/**
 * Convert device ID to WebHID device info for storage
 */
export function parseWebHIDDeviceId(deviceId: string): {
  vendorId: number;
  productId: number;
  serialNumber?: string;
} | null {
  const parts = deviceId.split('_');
  if (parts.length < 3 || parts[0] !== 'webhid') {
    return null;
  }

  return {
    vendorId: parseInt(parts[1], 16),
    productId: parseInt(parts[2], 16),
    serialNumber: parts.length > 3 ? parts.slice(3).join('_') : undefined,
  };
}

/**
 * Convert WebHID device to device ID string
 */
export function createWebHIDDeviceId(device: HIDDevice): string {
  return `webhid_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || 'unknown'}`;
}


