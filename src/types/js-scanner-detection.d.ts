declare module 'js-scanner-detection' {
  export interface ScannerDetectorOptions {
    onComplete?: (barcode: string) => void;
    onError?: (value: string) => void;
    onReceive?: (e: KeyboardEvent) => void;
    timeBeforeScanTest?: number;
    avgTimeByChar?: number;
    minLength?: number;
    endChar?: number[];
    stopPropagation?: boolean;
    preventDefault?: boolean;
  }

  export default class ScannerDetector {
    constructor(options: ScannerDetectorOptions);
    stopScanning(): void;
  }
}
