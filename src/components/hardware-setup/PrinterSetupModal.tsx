"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  Wifi,
  Usb,
  Laptop2,
  AlertCircle,
  Monitor,
  Printer,
} from "lucide-react";
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
import { RAWBT_PLAY_STORE_URL } from "@/lib/rawbt-print";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const QZ_TRAY_DOWNLOAD_URL = "https://qz.io/download/";

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

function getConnectionTypeLabel(
  ct: Device["connectionType"],
  t: (key: string) => string
): string {
  if (ct === "webusb") return t("hardware.connectionType.webusb");
  if (ct === "webhid") return t("hardware.connectionType.webhid");
  if (ct === "qz") return t("hardware.connectionType.qz");
  return t("hardware.connectionType.server");
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

  const handlePrinterChoiceQzTray = () => {
    searchQzPrinters();
  };

  const handlePrinterChoiceWebUsb = () => {
    searchWebUsbPrinters();
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
      setRawBtTestFeedback(
        err.message || t("hardware.rawBt.testFailed")
      );
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
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 text-left space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                {t("hardware.choice.howToPrint")}
              </p>

              {printStrategy === "desktop" && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t("hardware.choice.thermalQzTitle")}
                    </p>
                    <ol className="text-sm text-slate-700 list-decimal list-inside space-y-1 mb-2">
                      <li>{t("hardware.choice.stepDownloadQz")}</li>
                      <li>{t("hardware.choice.stepRunQz")}</li>
                      <li>{t("hardware.choice.stepFindPrinter")}</li>
                    </ol>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] touch-target"
                        asChild
                      >
                        <a
                          href={QZ_TRAY_DOWNLOAD_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("hardware.choice.downloadQz")}
                        </a>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="min-h-[44px] touch-target"
                        onClick={handlePrinterChoiceQzTray}
                      >
                        {t("hardware.choice.findMyPrinter")}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t("hardware.choice.webUsbTitle")}
                    </p>
                    <p className="text-sm text-slate-600 mb-2">
                      {t("hardware.choice.webUsbDescription")}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px] touch-target"
                      onClick={handlePrinterChoiceWebUsb}
                    >
                      <Usb className="mr-2 h-4 w-4" />
                      {t("hardware.choice.searchWebUsb")}
                    </Button>
                  </div>
                </>
              )}

              {printStrategy === "android" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t("hardware.choice.thermalRawBtTitle")}
                  </p>
                  <ol className="text-sm text-slate-700 list-decimal list-inside space-y-1 mb-2">
                    <li>{t("hardware.choice.stepInstallRawBt")}</li>
                    <li>{t("hardware.choice.stepPairRawBt")}</li>
                    <li>{t("hardware.choice.stepTestRawBt")}</li>
                    <li>{t("hardware.choice.stepSaveRawBt")}</li>
                  </ol>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] touch-target"
                      asChild
                    >
                      <a
                        href={RAWBT_PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("hardware.choice.getRawBt")}
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="min-h-[44px] touch-target"
                      onClick={handleRawBtTestPrint}
                      disabled={isRawBtTesting}
                    >
                      {isRawBtTesting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("hardware.choice.testing")}
                        </>
                      ) : (
                        <>
                          <Printer className="mr-2 h-4 w-4" />
                          {t("hardware.choice.testPrinter")}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px] touch-target"
                      onClick={handleRawBtSaveSetup}
                    >
                      {t("hardware.choice.saveSetup")}
                    </Button>
                    {rawBtTestFeedback ? (
                      <p
                        className={`text-xs text-left px-1 ${
                          rawBtTestOk ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {rawBtTestFeedback}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {t("hardware.choice.browserTitle")}
                </p>
                <p className="text-sm text-slate-600 mb-2">
                  {t("hardware.choice.browserDescription")}
                </p>
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] touch-target"
                  onClick={handlePrinterChoiceBrowser}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  {t("hardware.choice.useBrowserPrint")}
                </Button>
              </div>
            </div>
          )}

          {step === "searching" && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
                <div className="relative bg-primary/10 p-4 sm:p-6 rounded-full">
                  <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
                </div>
              </div>
              <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 px-4">
                {t("hardware.search.lookingForPrinters")}
              </h4>
              <p className="text-sm text-slate-500 px-4">
                {searchSource === "qz"
                  ? t("hardware.search.qzDiscovering")
                  : t("hardware.search.ensurePrinterOn")}
              </p>
            </div>
          )}

          {step === "found" && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
              <div className="text-left mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {availableDevices.length === 1
                    ? t("hardware.found.printer")
                    : t("hardware.found.printers", {
                        count: availableDevices.length,
                      })}
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
                          {deviceItem.connectionType === "qz" ? (
                            <Wifi
                              size={18}
                              className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary"
                            />
                          ) : deviceItem.connectionType === "webusb" ? (
                            <Usb
                              size={18}
                              className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary"
                            />
                          ) : (
                            <Wifi
                              size={18}
                              className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary"
                            />
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-slate-900 group-active:text-primary sm:group-hover:text-primary truncate">
                            {deviceItem.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {getConnectionTypeLabel(
                              deviceItem.connectionType,
                              t
                            )}{" "}
                            • {t("hardware.found.readyToPair")}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-primary opacity-100 sm:opacity-0 group-active:opacity-100 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        {t("hardware.found.connect")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-center text-slate-400 mt-4 sm:mt-8 px-2">
                {t("hardware.found.dontSeePrinter")}{" "}
                <button
                  onClick={handleRetry}
                  className="text-primary active:underline sm:hover:underline touch-target min-h-[44px]"
                >
                  {t("hardware.found.scanAgain")}
                </button>
              </p>
            </div>
          )}

          {step === "connecting" && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
              <div className="mb-4 sm:mb-6 relative">
                <Laptop2 className="w-14 h-14 sm:w-16 sm:h-16 text-slate-300" />
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
                </div>
              </div>
              <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2">
                {t("hardware.connecting.testPrintTitle")}
              </h4>
              <p className="text-sm text-slate-500">
                {t("hardware.connecting.testPrintDesc")}
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                {t("hardware.success.title")}
              </h4>
              <p className="text-sm text-slate-500">
                {t("hardware.success.printerReady")}
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                {t("hardware.error.connectionFailed")}
              </h4>
              <p className="text-sm text-slate-500 mb-4 text-center">{error}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setStep("choice")}
                  className="min-h-[44px] touch-target"
                >
                  {t("hardware.error.chooseAnotherMethod")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="min-h-[44px] touch-target"
                >
                  {t("hardware.error.tryAgain")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
