const COMMON_PRINTER_VENDORS = [
  0x04f9, 0x0519, 0x1504, 0x1cb0, 0x0a5f, 0x0483, 0x154f,
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

export function isWebUSBAvailable(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export async function getWebUSBPrinters(): Promise<WebUSBDevice[]> {
  if (!isWebUSBAvailable()) {
    return [];
  }

  console.log("getWebUSBPrinters", "available");

  if (!navigator.usb) {
    return [];
  }

  try {
    const devices = await navigator.usb.getDevices();
    console.log("getWebUSBPrinters", "devices found:", devices.length);
    console.log(
      "getWebUSBPrinters",
      "device details:",
      devices.map((d) => ({
        vendorId: d.vendorId.toString(16),
        productId: d.productId.toString(16),
        productName: d.productName,
        manufacturerName: d.manufacturerName,
      })),
    );

    return devices.map((device) => ({
      id: `webusb_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || "unknown"}`,
      vendorId: device.vendorId,
      productId: device.productId,
      manufacturer: device.manufacturerName,
      product: device.productName,
      serialNumber: device.serialNumber,
      name:
        device.productName ||
        `USB Device (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
      connected: device.opened,
    }));
  } catch (error) {
    console.error("Error getting WebUSB devices:", error);
    return [];
  }
}

export async function requestWebUSBPrinter(
  filters?: USBDeviceFilter[],
): Promise<USBDevice> {
  if (!isWebUSBAvailable() || !navigator.usb) {
    throw new Error("WebUSB API is not available in this browser");
  }

  try {
    const deviceFilters =
      filters !== undefined
        ? filters.length === 0
          ? undefined
          : filters
        : [...COMMON_PRINTER_VENDORS.map((vendorId) => ({ vendorId }))];

    const requestOptions: USBRequestDeviceOptions = deviceFilters
      ? { filters: deviceFilters }
      : { filters: [] };

    const device = await navigator.usb.requestDevice(requestOptions);
    console.log("requestWebUSBPrinter", "device selected:", {
      vendorId: device.vendorId.toString(16),
      productId: device.productId.toString(16),
      productName: device.productName,
    });
    return device;
  } catch (error: any) {
    if (error.name === "NotFoundError") {
      throw new Error("No printer device selected");
    }
    throw new Error(`Failed to request device: ${error.message}`);
  }
}

export async function connectWebUSBPrinter(
  vendorId: number,
  productId: number,
  serialNumber?: string,
): Promise<USBDevice> {
  if (!isWebUSBAvailable() || !navigator.usb) {
    throw new Error("WebUSB API is not available in this browser");
  }

  try {
    const devices = await navigator.usb.getDevices();
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

function findBulkOutEndpoint(device: USBDevice): USBEndpoint {
  const configuration = device.configuration;
  if (!configuration) {
    throw new Error("Device not configured");
  }

  for (const interface_ of configuration.interfaces) {
    const alternate = interface_.alternate;
    for (const endpoint of alternate.endpoints) {
      if (endpoint.direction === "out" && endpoint.type === "bulk") {
        return endpoint;
      }
    }
  }

  throw new Error("No bulk out endpoint found");
}

export async function printToWebUSB(
  deviceId: string,
  data: Uint8Array,
): Promise<PrintResponse> {
  if (!isWebUSBAvailable()) {
    throw new Error("WebUSB API is not available in this browser");
  }

  const parts = deviceId.split("_");
  if (parts.length < 3 || parts[0] !== "webusb") {
    throw new Error("Invalid WebUSB device ID format");
  }

  const vendorId = parseInt(parts[1], 16);
  const productId = parseInt(parts[2], 16);
  const serialNumber = parts.length > 3 ? parts.slice(3).join("_") : undefined;

  let device: USBDevice;
  try {
    device = await connectWebUSBPrinter(vendorId, productId, serialNumber);
  } catch (error: any) {
    throw new Error(`Failed to connect to printer: ${error.message}`);
  }

  try {
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const interfaceNumber = device.configuration!.interfaces[0].interfaceNumber;
    try {
      await device.claimInterface(interfaceNumber);
    } catch (error: any) {
      if (!error.message.includes("already claimed")) {
        throw error;
      }
    }

    const endpoint = findBulkOutEndpoint(device);

    const chunkSize = endpoint.packetSize || 64;
    let offset = 0;

    while (offset < data.length) {
      const chunk = data.slice(offset, offset + chunkSize);
      await device.transferOut(endpoint.endpointNumber, chunk);
      offset += chunkSize;
    }

    return {
      success: true,
      message: "Print job sent successfully",
      deviceId,
    };
  } catch (error: any) {
    throw new Error(`Print failed: ${error.message}`);
  } finally {
    // Don't close the device - keep it open for potential future prints
    // The device will be closed when the page is unloaded or device is disconnected
  }
}

export function parseWebUSBDeviceId(deviceId: string): {
  vendorId: number;
  productId: number;
  serialNumber?: string;
} | null {
  const parts = deviceId.split("_");
  if (parts.length < 3 || parts[0] !== "webusb") {
    return null;
  }

  return {
    vendorId: parseInt(parts[1], 16),
    productId: parseInt(parts[2], 16),
    serialNumber: parts.length > 3 ? parts.slice(3).join("_") : undefined,
  };
}

export function createWebUSBDeviceId(device: USBDevice): string {
  return `webusb_${device.vendorId.toString(16)}_${device.productId.toString(16)}_${device.serialNumber || "unknown"}`;
}
