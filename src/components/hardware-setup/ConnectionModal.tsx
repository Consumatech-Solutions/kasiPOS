"use client";

import React, { useState, useEffect } from "react";
import { HardwareDevice, ModalStep } from "./types";
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

function getConnectionTypeLabel(
  ct: Device["connectionType"],
  t: (key: string) => string
): string {
  if (ct === "webusb") return t("hardware.connectionType.webusb");
  if (ct === "webhid") return t("hardware.connectionType.webhid");
  if (ct === "qz") return t("hardware.connectionType.qz");
  return t("hardware.connectionType.server");
}

interface ConnectionModalProps {
  device: HardwareDevice;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (
    deviceId: string,
    deviceType: "printer" | "scanner" | "pos"
  ) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  device,
  isOpen,
  onClose,
  onConnect,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>("searching");
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRawBtTesting, setIsRawBtTesting] = useState(false);
  const [rawBtTestFeedback, setRawBtTestFeedback] = useState<string | null>(
    null
  );
  const [rawBtTestOk, setRawBtTestOk] = useState<boolean | null>(null);

  const isPrinter = device.id === "printer";
  const printStrategy = getPrintStrategy();

  const getServiceType = (): "printer" | "scanner" | "pos" => {
    if (device.id === "printer") return "printer";
    if (device.id === "scanner") return "scanner";
    return "pos";
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAvailableDevices([]);
      setIsRawBtTesting(false);
      setRawBtTestFeedback(null);
      setRawBtTestOk(null);
      if (isPrinter) {
        setStep("choice");
      } else {
        setStep("searching");
        searchForDevices();
      }
    }
  }, [isOpen, device.id, isPrinter]);

  const searchForDevices = async () => {
    try {
      setStep("searching");
      setError(null);
      const serviceType = getServiceType();
      const searchStartTime = Date.now();
      const devices = await getDevices(serviceType);
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;
      if (searchDuration < minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDelay - searchDuration)
        );
      }
      if (devices.length === 0) {
        setStep("error");
        setError(
          t("hardware.error.noDevices", {
            device: device.name.toLowerCase(),
          })
        );
        return;
      }
      setAvailableDevices(devices);
      setStep("found");
    } catch (err: any) {
      console.error("Error searching for devices:", err);
      setStep("error");
      setError(err.message || t("hardware.error.searchFailed"));
    }
  };

  const handlePrinterChoiceBrowser = () => {
    setPrinterMode("browser");
    onConnect("browser", "printer");
    onClose();
  };

  const handlePrinterChoiceThermalDesktop = () => {
    setStep("searching");
    searchForDevices();
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
    onConnect("thermal-android", "printer");
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
        onConnect(deviceId, "printer");
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Test print failed:", err);
      setStep("error");
      setError(err.message || t("hardware.error.testPrintFailed"));
    }
  };

  const connectDevice = async (deviceId: string) => {
    if (isPrinter) {
      await connectPrinterWithTest(deviceId);
      return;
    }
    try {
      setStep("connecting");
      setError(null);
      const serviceType = getServiceType();
      const selectedDevice = availableDevices.find((d) => d.id === deviceId);
      if (!selectedDevice) throw new Error(t("hardware.error.deviceNotFound"));
      storeDevice(serviceType, deviceId, selectedDevice.connectionType);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep("success");
      setTimeout(() => {
        onConnect(deviceId, serviceType);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Error connecting device:", err);
      setStep("error");
      setError(err.message || t("hardware.error.connectFailed"));
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
        <DialogHeader className="px-2 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl">
            {t("hardware.connect.title", { device: device.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
          {step === "choice" && isPrinter && (
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
                        onClick={handlePrinterChoiceThermalDesktop}
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
                      onClick={handlePrinterChoiceThermalDesktop}
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
                {t("hardware.search.lookingForDevices")}
              </h4>
              <p className="text-sm text-slate-500 px-4">
                {t("hardware.search.ensureDeviceOn", {
                  device: device.name.toLowerCase(),
                })}
              </p>
            </div>
          )}

          {step === "found" && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
              <div className="text-left mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {availableDevices.length === 1
                    ? t("hardware.found.device")
                    : t("hardware.found.devices", {
                        count: availableDevices.length,
                      })}
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableDevices.map((deviceItem) => (
                    <button
                      key={deviceItem.id}
                      onClick={() => connectDevice(deviceItem.id)}
                      className="w-full group flex items-center justify-between p-3 sm:p-4 border border-slate-200 rounded-xl active:border-primary active:shadow-md active:bg-primary/5 sm:hover:border-primary sm:hover:shadow-md sm:hover:bg-primary/5 transition-all cursor-pointer bg-white touch-target min-h-[60px]"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-active:bg-primary/10 sm:group-hover:bg-primary/10 transition-colors">
                          {deviceItem.connectionType === "webusb" ? (
                            <Usb
                              size={18}
                              className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary"
                            />
                          ) : deviceItem.connectionType === "webhid" ? (
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
                {t("hardware.found.dontSeeDevice")}{" "}
                <button
                  onClick={searchForDevices}
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
                {isPrinter
                  ? t("hardware.connecting.testPrintTitle")
                  : t("hardware.connecting.title")}
              </h4>
              <p className="text-sm text-slate-500">
                {isPrinter
                  ? t("hardware.connecting.testPrintDesc")
                  : t("hardware.connecting.secureConnection")}
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
                {t("hardware.success.deviceReady", {
                  device: device.name.toLowerCase(),
                })}
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
                {isPrinter && (
                  <Button
                    variant="outline"
                    onClick={() => setStep("choice")}
                    className="min-h-[44px] touch-target"
                  >
                    {t("hardware.error.chooseAnotherMethod")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={isPrinter ? searchForDevices : searchForDevices}
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
