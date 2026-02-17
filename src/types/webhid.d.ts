/**
 * WebHID API Type Definitions
 * Extends the Navigator interface to include the WebHID API
 */

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HIDCollection {
  usagePage: number;
  usage: number;
  children: HIDCollection[];
  inputReports?: HIDInputReportItem[];
  outputReports?: HIDOutputReportItem[];
  featureReports?: HIDFeatureReportItem[];
}

interface HIDInputReportItem {
  reportId?: number;
  usages: number[];
  data: DataView;
}

interface HIDOutputReportItem {
  reportId?: number;
  usages: number[];
  data: DataView;
}

interface HIDFeatureReportItem {
  reportId?: number;
  usages: number[];
  data: DataView;
}

interface HIDInputReportEvent extends Event {
  device: HIDDevice;
  reportId: number;
  data: DataView;
}

interface HIDDevice extends EventTarget {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollection[];
  readonly opened: boolean;

  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  addEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>;
}

interface Navigator {
  hid?: HID;
}

