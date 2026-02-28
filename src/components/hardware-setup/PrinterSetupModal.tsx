'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Wifi, Usb, Laptop2, AlertCircle, Monitor } from 'lucide-react';
import {
  getDevices,
  getQzDevices,
  storeDevice,
  setPrinterMode,
  printReceipt,
  buildTestPrintPayload,
  type Device,
} from '@/lib/device-service';
import { getPrintStrategy } from '@/lib/platform';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const QZ_TRAY_DOWNLOAD_URL = 'https://qz.io/download/';
const RAWBT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ru.a40243.rawbt';
const POS_PRINTER_DRIVER_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fidelier.printfromweb';

type PrinterStep = 'choice' | 'searching' | 'found' | 'connecting' | 'success' | 'error';
type SearchSource = 'qz' | 'webusb' | null;

interface PrinterSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (deviceId: string) => void;
}

function getConnectionTypeLabel(ct: Device['connectionType']): string {
  if (ct === 'webusb') return 'WebUSB';
  if (ct === 'webhid') return 'WebHID';
  if (ct === 'qz') return 'QZ Tray';
  return 'Server';
}

export const PrinterSetupModal: React.FC<PrinterSetupModalProps> = ({ open, onClose, onSuccess }) => {
  const [step, setStep] = useState<PrinterStep>('choice');
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<SearchSource>(null);

  const printStrategy = getPrintStrategy();

  useEffect(() => {
    if (open) {
      setError(null);
      setAvailableDevices([]);
      setSearchSource(null);
      setStep('choice');
    }
  }, [open]);

  const searchQzPrinters = async () => {
    setSearchSource('qz');
    setStep('searching');
    setError(null);
    try {
      const searchStartTime = Date.now();
      const devices = await getQzDevices();
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;
      if (searchDuration < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - searchDuration));
      }
      if (devices.length === 0) {
        setStep('error');
        setError('No QZ Tray printers found. Please ensure QZ Tray is running and your printer is installed.');
        return;
      }
      setAvailableDevices(devices);
      setStep('found');
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Failed to get QZ Tray printers');
    }
  };

  const searchWebUsbPrinters = async () => {
    setSearchSource('webusb');
    setStep('searching');
    setError(null);
    try {
      const searchStartTime = Date.now();
      const devices = await getDevices('printer');
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;
      if (searchDuration < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - searchDuration));
      }
      if (devices.length === 0) {
        setStep('error');
        setError('No WebUSB or printer server devices found. Connect a device and try again.');
        return;
      }
      setAvailableDevices(devices);
      setStep('found');
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Failed to search for devices');
    }
  };

  const handlePrinterChoiceBrowser = () => {
    setPrinterMode('browser');
    onSuccess?.('browser');
    onClose();
  };

  const handlePrinterChoiceQzTray = () => {
    searchQzPrinters();
  };

  const handlePrinterChoiceWebUsb = () => {
    searchWebUsbPrinters();
  };

  const handlePrinterChoiceThermalAndroid = () => {
    setPrinterMode('thermal');
    onSuccess?.('thermal-android');
    onClose();
  };

  const connectPrinterWithTest = async (deviceId: string) => {
    const selectedDevice = availableDevices.find((d) => d.id === deviceId);
    if (!selectedDevice) {
      setError('Selected device not found');
      setStep('error');
      return;
    }
    try {
      setStep('connecting');
      setError(null);
      const testPayload = buildTestPrintPayload();
      await printReceipt(deviceId, testPayload);
      storeDevice('printer', deviceId, selectedDevice.connectionType);
      setPrinterMode('thermal');
      setStep('success');
      setTimeout(() => {
        onSuccess?.(deviceId);
        onClose();
      }, 1500);
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Test print failed. Please ensure the printer is on and try again.');
    }
  };

  const handleRetry = () => {
    if (searchSource === 'qz') {
      searchQzPrinters();
    } else if (searchSource === 'webusb') {
      searchWebUsbPrinters();
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
        <DialogHeader className="px-2 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl">Connect Receipt Printer</DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
          {step === 'choice' && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 text-left space-y-4">
              <p className="text-sm text-slate-600 mb-4">How do you want to print receipts?</p>

              {printStrategy === 'desktop' && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Thermal printer (QZ Tray)
                    </p>
                    <ol className="text-sm text-slate-700 list-decimal list-inside space-y-1 mb-2">
                      <li>Download and install QZ Tray</li>
                      <li>Run QZ Tray and keep it running</li>
                      <li>Use the button below to find your printer</li>
                    </ol>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-target" asChild>
                        <a href={QZ_TRAY_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                          Download QZ Tray
                        </a>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="min-h-[44px] touch-target"
                        onClick={handlePrinterChoiceQzTray}
                      >
                        Find my printer
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      WebUSB / printer server
                    </p>
                    <p className="text-sm text-slate-600 mb-2">
                      If you use a USB printer or a local printer server, find it below.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px] touch-target"
                      onClick={handlePrinterChoiceWebUsb}
                    >
                      <Usb className="mr-2 h-4 w-4" />
                      Search for WebUSB or server printer
                    </Button>
                  </div>
                </>
              )}

              {printStrategy === 'android' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Thermal printer (RawBT or POS Printer Driver)
                  </p>
                  <ol className="text-sm text-slate-700 list-decimal list-inside space-y-1 mb-2">
                    <li>Install RawBT or POS Printer Driver from the Play Store</li>
                    <li>Open the app and pair your Xprinter XP-P201A (or other thermal printer)</li>
                    <li>Return here and complete setup</li>
                  </ol>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="min-h-[44px] touch-target" asChild>
                      <a href={RAWBT_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                        Get RawBT on Play Store
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="min-h-[44px] touch-target" asChild>
                      <a href={POS_PRINTER_DRIVER_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                        Get POS Printer Driver on Play Store
                      </a>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px] touch-target"
                      onClick={handlePrinterChoiceThermalAndroid}
                    >
                      I&apos;ve installed the app, continue
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Normal printing (browser)
                </p>
                <p className="text-sm text-slate-600 mb-2">
                  Use your browser&apos;s print dialog. No extra app or device needed.
                </p>
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] touch-target"
                  onClick={handlePrinterChoiceBrowser}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  Use browser print
                </Button>
              </div>
            </div>
          )}

          {step === 'searching' && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
                <div className="relative bg-primary/10 p-4 sm:p-6 rounded-full">
                  <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
                </div>
              </div>
              <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 px-4">
                Looking for printers...
              </h4>
              <p className="text-sm text-slate-500 px-4">
                {searchSource === 'qz'
                  ? 'Connecting to QZ Tray and discovering printers.'
                  : 'Ensure your printer is turned on and nearby.'}
              </p>
            </div>
          )}

          {step === 'found' && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
              <div className="text-left mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {availableDevices.length === 1 ? 'Printer Found' : `Printers Found (${availableDevices.length})`}
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableDevices.map((deviceItem) => (
                    <button
                      key={deviceItem.id}
                      onClick={() => connectPrinterWithTest(deviceItem.id)}
                      className="w-full group flex items-center justify-between p-3 sm:p-4 border border-slate-200 rounded-xl active:border-primary active:shadow-md active:bg-primary/5 sm:hover:border-primary sm:hover:shadow-md sm:hover:bg-primary/5 transition-all cursor-pointer bg-white touch-target min-h-[60px]"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-active:bg-primary/10 sm:group-hover:bg-primary/10 transition-colors">
                          {deviceItem.connectionType === 'qz' ? (
                            <Wifi size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                          ) : deviceItem.connectionType === 'webusb' ? (
                            <Usb size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                          ) : (
                            <Wifi size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-slate-900 group-active:text-primary sm:group-hover:text-primary truncate">
                            {deviceItem.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {getConnectionTypeLabel(deviceItem.connectionType)} • Ready to pair
                          </p>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-primary opacity-100 sm:opacity-0 group-active:opacity-100 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        Connect
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-center text-slate-400 mt-4 sm:mt-8 px-2">
                Don&apos;t see your printer?{' '}
                <button
                  onClick={handleRetry}
                  className="text-primary active:underline sm:hover:underline touch-target min-h-[44px]"
                >
                  Scan again
                </button>
              </p>
            </div>
          )}

          {step === 'connecting' && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
              <div className="mb-4 sm:mb-6 relative">
                <Laptop2 className="w-14 h-14 sm:w-16 sm:h-16 text-slate-300" />
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
                </div>
              </div>
              <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2">Sending test print...</h4>
              <p className="text-sm text-slate-500">
                A test receipt will print. This verifies your printer is working.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Connected!</h4>
              <p className="text-sm text-slate-500">Your printer is ready to use.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Connection Failed</h4>
              <p className="text-sm text-slate-500 mb-4 text-center">{error}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setStep('choice')}
                  className="min-h-[44px] touch-target"
                >
                  Choose another method
                </Button>
                <Button variant="outline" onClick={handleRetry} className="min-h-[44px] touch-target">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
