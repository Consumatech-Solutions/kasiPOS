"use client";

import React, { useState, useEffect } from "react";
import {
  getDevices,
  getQzDevices,
  storeDevice,
  setPrinterMode,
  printReceipt,
  buildTestPrintPayload,
  type Device,
} from "@/lib/device-service";
import { getPrintStrategy } from "@/lib/platform";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import {
  HardwareConnectingStep,
  HardwareDeviceListStep,
  HardwareErrorStep,
  HardwareSearchingStep,
  HardwareSuccessStep,
  PrinterConnectionChoice,
} from "./hardware-ui";

type PrinterStep =
  | "choice"
  | "searching"
  | "found"
  | "connecting"
  | "success"
  | "error";
type SearchSource = "qz" | "webusb" | null;

interface PrinterSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (deviceId: string) => void;
}

export const PrinterSetupModal: React.FC<PrinterSetupModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<PrinterStep>("choice");
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<SearchSource>(null);
  const [isRawBtTesting, setIsRawBtTesting] = useState(false);
  const [rawBtTestFeedback, setRawBtTestFeedback] = useState<string | null>(
    null
  );
  const [rawBtTestOk, setRawBtTestOk] = useState<boolean | null>(null);

  const printStrategy = getPrintStrategy();

  useEffect(() => {
    if (open) {
      setError(null);
      setAvailableDevices([]);
      setSearchSource(null);
      setStep("choice");
      setIsRawBtTesting(false);
      setRawBtTestFeedback(null);
      setRawBtTestOk(null);
    }
  }, [open]);

  const searchQzPrinters = async () => {
    setSearchSource("qz");
    setStep("searching");
    setError(null);
    try {
      const searchStartTime = Date.now();
      const devices = await getQzDevices();
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;
      if (searchDuration < minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDelay - searchDuration)
        );
      }
      if (devices.length === 0) {
        setStep("error");
        setError(t("hardware.error.noQzPrinters"));
        return;
      }
      setAvailableDevices(devices);
      setStep("found");
    } catch (err: any) {
      setStep("error");
      setError(err.message || t("hardware.error.qzFailed"));
    }
  };

  const searchWebUsbPrinters = async () => {
    setSearchSource("webusb");
    setStep("searching");
    setError(null);
    try {
      const searchStartTime = Date.now();
      const devices = await getDevices("printer");
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;
      if (searchDuration < minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDelay - searchDuration)
        );
      }
      if (devices.length === 0) {
        setStep("error");
        setError(t("hardware.error.noWebUsbPrinters"));
        return;
      }
      setAvailableDevices(devices);
      setStep("found");
    } catch (err: any) {
      setStep("error");
      setError(err.message || t("hardware.error.searchFailed"));
    }
  };

  const handlePrinterChoiceBrowser = () => {
    setPrinterMode("browser");
    onSuccess?.("browser");
    onClose();
  };

  const handleRawBtTestPrint = async () => {
    setIsRawBtTesting(true);
    setRawBtTestFeedback(null);
    setRawBtTestOk(null);
    try {
      await printReceipt("thermal-android", buildTestPrintPayload());
      setRawBtTestOk(true);
      setRawBtTestFeedback(t("hardware.rawBt.testSent"));
    } catch (err: any) {
      setRawBtTestOk(false);
      setRawBtTestFeedback(err.message || t("hardware.rawBt.testFailed"));
    } finally {
      setIsRawBtTesting(false);
    }
  };

  const handleRawBtSaveSetup = () => {
    setPrinterMode("thermal");
    storeDevice("printer", "thermal-android");
    onSuccess?.("thermal-android");
    onClose();
  };

  const connectPrinterWithTest = async (deviceId: string) => {
    const selectedDevice = availableDevices.find((d) => d.id === deviceId);
    if (!selectedDevice) {
      setError(t("hardware.error.deviceNotFound"));
      setStep("error");
      return;
    }
    try {
      setStep("connecting");
      setError(null);
      const testPayload = buildTestPrintPayload();
      await printReceipt(deviceId, testPayload);
      storeDevice("printer", deviceId, selectedDevice.connectionType);
      setPrinterMode("thermal");
      setStep("success");
      setTimeout(() => {
        onSuccess?.(deviceId);
        onClose();
      }, 1500);
    } catch (err: any) {
      setStep("error");
      setError(err.message || t("hardware.error.testPrintFailed"));
    }
  };

  const handleRetry = () => {
    if (searchSource === "qz") {
      searchQzPrinters();
    } else if (searchSource === "webusb") {
      searchWebUsbPrinters();
    }
  };

  const foundTitle =
    availableDevices.length === 1
      ? t("hardware.found.printer")
      : t("hardware.found.printers", { count: availableDevices.length });

  const searchingDescription =
    searchSource === "qz"
      ? t("hardware.search.qzDiscovering")
      : t("hardware.search.ensurePrinterOn");

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
        <DialogHeader className="px-2 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl">
            {t("hardware.printer.connectTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
          {step === "choice" && (
            <PrinterConnectionChoice
              printStrategy={printStrategy}
              onBrowserPrint={handlePrinterChoiceBrowser}
              onFindQzPrinter={searchQzPrinters}
              onSearchWebUsb={searchWebUsbPrinters}
              onRawBtTest={handleRawBtTestPrint}
              onRawBtSave={handleRawBtSaveSetup}
              isRawBtTesting={isRawBtTesting}
              rawBtTestFeedback={rawBtTestFeedback}
              rawBtTestOk={rawBtTestOk}
            />
          )}

          {step === "searching" && (
            <HardwareSearchingStep
              titleKey="hardware.search.lookingForPrinters"
              description={searchingDescription}
            />
          )}

          {step === "found" && (
            <HardwareDeviceListStep
              devices={availableDevices}
              foundTitle={foundTitle}
              notFoundPromptKey="hardware.found.dontSeePrinter"
              onSelect={connectPrinterWithTest}
              onRescan={handleRetry}
            />
          )}

          {step === "connecting" && (
            <HardwareConnectingStep
              titleKey="hardware.connecting.testPrintTitle"
              descriptionKey="hardware.connecting.testPrintDesc"
            />
          )}

          {step === "success" && (
            <HardwareSuccessStep descriptionKey="hardware.success.printerReady" />
          )}

          {step === "error" && (
            <HardwareErrorStep
              error={error}
              onTryAgain={handleRetry}
              onChooseAnother={() => setStep("choice")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
