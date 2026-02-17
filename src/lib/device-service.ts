/**
 * Device Service - API client for printer-server
 * Handles communication with the printer-server running on localhost:7788
 * Also supports WebUSB (printers) and WebHID (scanners) as primary methods
 */

import {
  getWebUSBPrinters,
  printToWebUSB,
  isWebUSBAvailable,
  type WebUSBDevice,
} from './webusb-printer';
import {
  getWebHIDScanners,
  scanBarcodeFromWebHID,
  pollWebHIDScanner,
  isWebHIDAvailable,
  type WebHIDDevice,
} from './webhid-scanner';

const PRINTER_SERVER_URL = 'http://localhost:7788';

export interface Device {
  id: string;
  type: 'printer' | 'scanner' | 'pos';
  connection: 'usb' | 'bluetooth' | 'serial';
  connectionType: 'webusb' | 'webhid' | 'server';
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

const CONNECTION_TYPE_KEY = 'kasiPOS_deviceConnectionType';

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
 * Tries WebUSB/WebHID first, then falls back to server API
 */
export async function getDevices(type?: 'printer' | 'scanner' | 'pos'): Promise<Device[]> {
  const devices: Device[] = [];

  // Try WebUSB for printers
  if ((!type || type === 'printer' || type === 'pos') && isWebUSBAvailable()) {
    try {
      const webusbDevices = await getWebUSBPrinters();
      devices.push(
        ...webusbDevices.map((d) => ({
          id: d.id,
          type: 'printer' as const,
          connection: 'usb' as const,
          connectionType: 'webusb' as const,
          name: d.name,
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturer,
          product: d.product,
          serialNumber: d.serialNumber,
          connected: d.connected,
        }))
      );
    } catch (error) {
      console.error('Error getting WebUSB printers:', error);
    }
  }

  // Try WebHID for scanners
  if ((!type || type === 'scanner') && isWebHIDAvailable()) {
    try {
      const webhidDevices = await getWebHIDScanners();
      devices.push(
        ...webhidDevices.map((d) => ({
          id: d.id,
          type: 'scanner' as const,
          connection: 'usb' as const,
          connectionType: 'webhid' as const,
          name: d.name,
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturer,
          product: d.product,
          serialNumber: d.serialNumber,
          connected: d.connected,
        }))
      );
    } catch (error) {
      console.error('Error getting WebHID scanners:', error);
    }
  }

  // Fallback to server API if available
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
          connectionType: 'server' as const,
        }));
        devices.push(...serverDevices);
      }
    } catch (error: any) {
      // Only throw if we have no devices from WebUSB/WebHID
      if (devices.length === 0) {
        if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
          throw new Error('Cannot connect to printer server. Make sure it is running on localhost:7788');
        }
        throw error;
      }
    }
  } else if (devices.length === 0) {
    // No WebUSB/WebHID devices and server is not available
    throw new Error('No devices available. WebUSB/WebHID not supported or printer server not running.');
  }

  // Filter by type if specified
  let filteredDevices = devices;
  if (type) {
    filteredDevices = devices.filter((d) => {
      if (type === 'pos') {
        return d.type === 'printer' || d.type === 'pos';
      }
      return d.type === type;
    });
  }

  // Prioritize WebUSB/WebHID devices: WebUSB first, then WebHID, then Server
  const priorityOrder: Record<string, number> = {
    'webusb': 1,
    'webhid': 2,
    'server': 3,
  };

  return filteredDevices.sort((a, b) => {
    const aPriority = priorityOrder[a.connectionType || 'server'] || 3;
    const bPriority = priorityOrder[b.connectionType || 'server'] || 3;
    return aPriority - bPriority;
  });
}

/**
 * Print receipt data to a specific printer device
 * Uses WebUSB if device ID starts with 'webusb_', otherwise falls back to server API
 */
export async function printReceipt(deviceId: string, data: Uint8Array): Promise<PrintResponse> {
  // Check if this is a WebUSB device
  if (deviceId.startsWith('webusb_')) {
    if (!isWebUSBAvailable()) {
      throw new Error('WebUSB API is not available in this browser');
    }
    return await printToWebUSB(deviceId, data);
  }

  // Fallback to server API
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
 * Uses WebHID if device ID starts with 'webhid_', otherwise falls back to server API
 */
export async function scanBarcode(deviceId: string, timeout: number = 5000): Promise<ScanResponse> {
  // Check if this is a WebHID device
  if (deviceId.startsWith('webhid_')) {
    if (!isWebHIDAvailable()) {
      throw new Error('WebHID API is not available in this browser');
    }
    return await scanBarcodeFromWebHID(deviceId, timeout);
  }

  // Fallback to server API
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
 * Uses WebHID if device ID starts with 'webhid_', otherwise falls back to server API
 */
export async function pollScanner(
  deviceId: string,
  onProgress?: () => void,
  pollInterval: number = 500
): Promise<string> {
  // Check if this is a WebHID device
  if (deviceId.startsWith('webhid_')) {
    if (!isWebHIDAvailable()) {
      throw new Error('WebHID API is not available in this browser');
    }
    return await pollWebHIDScanner(deviceId, onProgress, pollInterval);
  }

  // Fallback to server API
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
 * Get stored device connection type from localStorage
 */
export function getStoredDeviceConnectionType(type: 'printer' | 'scanner' | 'pos'): 'webusb' | 'webhid' | 'server' | null {
  if (typeof window === 'undefined') return null;
  const key = `${CONNECTION_TYPE_KEY}_${type}`;
  const stored = localStorage.getItem(key);
  if (stored === 'webusb' || stored === 'webhid' || stored === 'server') {
    return stored;
  }
  // Infer from device ID if connection type not stored
  const deviceId = getStoredDevice(type);
  if (deviceId?.startsWith('webusb_')) return 'webusb';
  if (deviceId?.startsWith('webhid_')) return 'webhid';
  return 'server';
}

/**
 * Store device ID in localStorage
 */
export function storeDevice(type: 'printer' | 'scanner' | 'pos', deviceId: string, connectionType?: 'webusb' | 'webhid' | 'server'): void {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEYS[type];
  localStorage.setItem(key, deviceId);
  
  // Store connection type
  if (connectionType) {
    const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
    localStorage.setItem(typeKey, connectionType);
  } else {
    // Infer connection type from device ID
    if (deviceId.startsWith('webusb_')) {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, 'webusb');
    } else if (deviceId.startsWith('webhid_')) {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, 'webhid');
    } else {
      const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
      localStorage.setItem(typeKey, 'server');
    }
  }
}

/**
 * Clear stored device ID from localStorage
 */
export function clearStoredDevice(type: 'printer' | 'scanner' | 'pos'): void {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEYS[type];
  localStorage.removeItem(key);
  const typeKey = `${CONNECTION_TYPE_KEY}_${type}`;
  localStorage.removeItem(typeKey);
}

