/**
 * Device Service - API client for printer-server
 * Handles communication with the printer-server running on localhost:7788
 */

const PRINTER_SERVER_URL = 'http://localhost:7788';

export interface Device {
  id: string;
  type: 'printer' | 'scanner' | 'pos';
  connection: 'usb' | 'bluetooth' | 'serial';
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
  printer: 'kasiPOS_printerDeviceId',
  scanner: 'kasiPOS_scannerDeviceId',
  pos: 'kasiPOS_posDeviceId',
} as const;

/**
 * Check if printer-server is accessible
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/devices`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all devices or devices filtered by type
 */
export async function getDevices(type?: 'printer' | 'scanner' | 'pos'): Promise<Device[]> {
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    throw new Error('Printer server is not running. Please start the printer server on localhost:7788');
  }

  try {
    const url = type 
      ? `${PRINTER_SERVER_URL}/devices/${type}`
      : `${PRINTER_SERVER_URL}/devices`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }
    
    const data: DevicesResponse = await response.json();
    return data.devices || [];
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to printer server. Make sure it is running on localhost:7788');
    }
    throw error;
  }
}

/**
 * Print receipt data to a specific printer device
 */
export async function printReceipt(deviceId: string, data: Uint8Array): Promise<PrintResponse> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        data: Array.from(data), // Convert Uint8Array to array for JSON
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Print failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to printer server. Make sure it is running on localhost:7788');
    }
    throw error;
  }
}

/**
 * Scan barcode from a scanner device (single read with timeout)
 */
export async function scanBarcode(deviceId: string, timeout: number = 5000): Promise<ScanResponse> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        action: 'read',
        timeout,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      if (response.status === 408) {
        // Timeout is expected, return empty result
        throw new Error('TIMEOUT');
      }
      throw new Error(error.error || `Scan failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'TIMEOUT') {
      throw error; // Re-throw timeout to be handled by caller
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to printer server. Make sure it is running on localhost:7788');
    }
    throw error;
  }
}

/**
 * Poll scanner device continuously until a barcode is read
 */
export async function pollScanner(
  deviceId: string,
  onProgress?: () => void,
  pollInterval: number = 500
): Promise<string> {
  const maxAttempts = 200; // 200 attempts * 500ms = 100 seconds max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const result = await scanBarcode(deviceId, pollInterval + 100); // Slightly longer timeout than poll interval
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
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      // Other errors should be thrown
      throw error;
    }
  }

  throw new Error('Scanner polling timeout - no barcode detected');
}

/**
 * Connect to POS device (placeholder for future POS commands)
 */
export async function connectPos(deviceId: string, command?: string): Promise<PosResponse> {
  try {
    const response = await fetch(`${PRINTER_SERVER_URL}/pos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        command: command || '',
        timeout: 5000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `POS connection failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to printer server. Make sure it is running on localhost:7788');
    }
    throw error;
  }
}

/**
 * Get stored device ID from localStorage
 */
export function getStoredDevice(type: 'printer' | 'scanner' | 'pos'): string | null {
  if (typeof window === 'undefined') return null;
  const key = STORAGE_KEYS[type];
  return localStorage.getItem(key);
}

/**
 * Store device ID in localStorage
 */
export function storeDevice(type: 'printer' | 'scanner' | 'pos', deviceId: string): void {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEYS[type];
  localStorage.setItem(key, deviceId);
}

/**
 * Clear stored device ID from localStorage
 */
export function clearStoredDevice(type: 'printer' | 'scanner' | 'pos'): void {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEYS[type];
  localStorage.removeItem(key);
}

