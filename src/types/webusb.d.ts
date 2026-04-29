/**
 * WebUSB API Type Definitions
 * Extends the Navigator interface to include the WebUSB API
 */

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBRequestDeviceOptions {
  filters: USBDeviceFilter[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
  packetSize: number;
}

interface USBAlternateInterface {
  alternateSetting: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
  alternates: USBAlternateInterface[];
  claimed: boolean;
}

interface USBConfiguration {
  configurationValue: number;
  configurationName?: string;
  interfaces: USBInterface[];
}

interface USBDevice extends EventTarget {
  readonly usbVersionMajor: number;
  readonly usbVersionMinor: number;
  readonly usbVersionSubminor: number;
  readonly deviceClass: number;
  readonly deviceSubclass: number;
  readonly deviceProtocol: number;
  readonly vendorId: number;
  readonly productId: number;
  readonly deviceVersionMajor: number;
  readonly deviceVersionMinor: number;
  readonly deviceVersionSubminor: number;
  readonly manufacturerName?: string;
  readonly productName?: string;
  readonly serialNumber?: string;
  readonly configuration?: USBConfiguration;
  readonly configurations: USBConfiguration[];
  readonly opened: boolean;

  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number
  ): Promise<void>;
  controlTransferIn(
    setup: USBControlTransferParameters,
    length: number
  ): Promise<USBInTransferResult>;
  controlTransferOut(
    setup: USBControlTransferParameters,
    data?: BufferSource
  ): Promise<USBOutTransferResult>;
  clearHalt(direction: "in" | "out", endpointNumber: number): Promise<void>;
  transferIn(
    endpointNumber: number,
    length: number
  ): Promise<USBInTransferResult>;
  transferOut(
    endpointNumber: number,
    data: BufferSource
  ): Promise<USBOutTransferResult>;
  reset(): Promise<void>;
}

interface USBControlTransferParameters {
  requestType: "standard" | "class" | "vendor";
  recipient: "device" | "interface" | "endpoint" | "other";
  request: number;
  value: number;
  index: number;
}

interface USBInTransferResult {
  status: "ok" | "stall" | "babble";
  data?: DataView;
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}

interface USB extends EventTarget {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBRequestDeviceOptions): Promise<USBDevice>;
}

interface Navigator {
  usb?: USB;
}
