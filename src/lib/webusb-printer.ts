/**
 * WebUSB Printer Service
 * Handles WebUSB communication with thermal/POS printers using ESC/POS protocol
 */

// Common thermal printer vendor IDs
const COMMON_PRINTER_VENDORS = [
  0x04f9, // Epson
  0x0519, // Star Micronics
  0x1504, // Bixolon
  0x1cb0, // Citizen
  0x0a5f, // Zebra
  0x0483, // STMicroelectronics (some printers)
  0x154f, // Bixolon
] as const;

export interface WebUSBDevice {
  id: string;
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  name: string;
  connected: boolean;
}

export interface PrintResponse {
  success: boolean;
  message: string;
  deviceId?: string;
}

/**
 * Check if WebUSB API is available
 */
export function isWebUSBAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Get connected WebUSB printer devices
 * Returns all USB devices that have been previously granted access
 * (not just common printer vendors, to support any POS printer)
 */
export async function getWebUSBPrinters(): Promise<WebUSBDevice[]> {
  if (!isWebUSBAvailable()) {
    return [];
  }

  console.log('getWebUSBPrinters', 'available');

  if (!navigator.usb) {
    return [];
  }

  try {
    const devices = await navigator.usb.getDevices();
    console.log('getWebUSBPrinters', 'devices found:', devices.length);
    console.log('getWebUSBPrinters', 'device details:', devices.map(d => ({
      vendorId: d.vendorId.toString(16),
      productId: d.productId.toString(16),
      productName: d.productName,
      manufacturerName: d.manufacturerName,
    })));
    
    // Return all granted USB devices (not just common vendors)
    // This allows users to connect any POS printer, not just those in the common list
    return devices.map((device) => ({
      id: `webusb_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || 'unknown'}`,
      vendorId: device.vendorId,
      productId: device.productId,
      manufacturer: device.manufacturerName,
      product: device.productName,
      serialNumber: device.serialNumber,
      name: device.productName || `USB Device (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
      connected: device.opened,
    }));
  } catch (error) {
    console.error('Error getting WebUSB devices:', error);
    return [];
  }
}

/**
 * Request access to a WebUSB printer device
 * If no filters are provided, shows all USB devices (allows any POS printer)
 * If filters are provided, uses those filters
 * If filters is an empty array, shows all USB devices
 */
export async function requestWebUSBPrinter(
  filters?: USBDeviceFilter[]
): Promise<USBDevice> {
  if (!isWebUSBAvailable() || !navigator.usb) {
    throw new Error('WebUSB API is not available in this browser');
  }

  try {
    // If filters is explicitly an empty array or undefined, show all devices
    // Otherwise, use the provided filters or default to common printer vendors
    const deviceFilters = filters !== undefined 
      ? (filters.length === 0 ? undefined : filters)
      : [
          // Default filters for common printer vendors (but user can still select others)
          ...COMMON_PRINTER_VENDORS.map((vendorId) => ({ vendorId })),
        ];
    
    // If deviceFilters is undefined, requestDevice will show all USB devices
    const requestOptions: USBRequestDeviceOptions = deviceFilters 
      ? { filters: deviceFilters }
      : { filters: [] }; // Empty filters array shows all devices
    
    const device = await navigator.usb.requestDevice(requestOptions);
    console.log('requestWebUSBPrinter', 'device selected:', {
      vendorId: device.vendorId.toString(16),
      productId: device.productId.toString(16),
      productName: device.productName,
    });
    return device;
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      throw new Error('No printer device selected');
    }
    throw new Error(`Failed to request device: ${error.message}`);
  }
}

/**
 * Connect to a WebUSB printer device by vendor/product ID
 */
export async function connectWebUSBPrinter(
  vendorId: number,
  productId: number,
  serialNumber?: string
): Promise<USBDevice> {
  if (!isWebUSBAvailable() || !navigator.usb) {
    throw new Error('WebUSB API is not available in this browser');
  }

  try {
    const devices = await navigator.usb.getDevices();
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
 * Find the bulk out endpoint for printing
 */
function findBulkOutEndpoint(device: USBDevice): USBEndpoint {
  const configuration = device.configuration;
  if (!configuration) {
    throw new Error('Device not configured');
  }

  for (const interface_ of configuration.interfaces) {
    const alternate = interface_.alternate;
    for (const endpoint of alternate.endpoints) {
      if (
        endpoint.direction === 'out' &&
        endpoint.type === 'bulk'
      ) {
        return endpoint;
      }
    }
  }

  throw new Error('No bulk out endpoint found');
}

/**
 * Print data to a WebUSB printer device
 */
export async function printToWebUSB(
  deviceId: string,
  data: Uint8Array
): Promise<PrintResponse> {
  if (!isWebUSBAvailable()) {
    throw new Error('WebUSB API is not available in this browser');
  }

  // Parse device ID: webusb_vendorId_productId_serialNumber
  const parts = deviceId.split('_');
  if (parts.length < 3 || parts[0] !== 'webusb') {
    throw new Error('Invalid WebUSB device ID format');
  }

  const vendorId = parseInt(parts[1], 16);
  const productId = parseInt(parts[2], 16);
  const serialNumber = parts.length > 3 ? parts.slice(3).join('_') : undefined;

  let device: USBDevice;
  try {
    device = await connectWebUSBPrinter(vendorId, productId, serialNumber);
  } catch (error: any) {
    throw new Error(`Failed to connect to printer: ${error.message}`);
  }

  try {
    // Select configuration (usually configuration 1)
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    // Claim interface (usually interface 0)
    const interfaceNumber = device.configuration!.interfaces[0].interfaceNumber;
    try {
      await device.claimInterface(interfaceNumber);
    } catch (error: any) {
      // Interface might already be claimed
      if (!error.message.includes('already claimed')) {
        throw error;
      }
    }

    // Find bulk out endpoint
    const endpoint = findBulkOutEndpoint(device);

    // Send data in chunks (USB has packet size limits, typically 64 bytes)
    const chunkSize = endpoint.packetSize || 64;
    let offset = 0;

    while (offset < data.length) {
      const chunk = data.slice(offset, offset + chunkSize);
      await device.transferOut(endpoint.endpointNumber, chunk);
      offset += chunkSize;
    }

    return {
      success: true,
      message: 'Print job sent successfully',
      deviceId,
    };
  } catch (error: any) {
    throw new Error(`Print failed: ${error.message}`);
  } finally {
    // Don't close the device - keep it open for potential future prints
    // The device will be closed when the page is unloaded or device is disconnected
  }
}

/**
 * Convert device ID to WebUSB device info for storage
 */
export function parseWebUSBDeviceId(deviceId: string): {
  vendorId: number;
  productId: number;
  serialNumber?: string;
} | null {
  const parts = deviceId.split('_');
  if (parts.length < 3 || parts[0] !== 'webusb') {
    return null;
  }

  return {
    vendorId: parseInt(parts[1], 16),
    productId: parseInt(parts[2], 16),
    serialNumber: parts.length > 3 ? parts.slice(3).join('_') : undefined,
  };
}

/**
 * Convert WebUSB device to device ID string
 */
export function createWebUSBDeviceId(device: USBDevice): string {
  return `webusb_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || 'unknown'}`;
}


