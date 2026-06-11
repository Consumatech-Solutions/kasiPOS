"use client";

import React, { useState, useEffect } from "react";
import { HardwareDevice, ModalStep } from "./types";
import {
  getDevices,
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
      setRawBtTestFeedback(err.message || t("hardware.rawBt.testFailed"));
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

  const foundTitle =
    availableDevices.length === 1
      ? t("hardware.found.device")
      : t("hardware.found.devices", { count: availableDevices.length });

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
            <PrinterConnectionChoice
              printStrategy={printStrategy}
              onBrowserPrint={handlePrinterChoiceBrowser}
              onFindQzPrinter={handlePrinterChoiceThermalDesktop}
              onSearchWebUsb={handlePrinterChoiceThermalDesktop}
              onRawBtTest={handleRawBtTestPrint}
              onRawBtSave={handleRawBtSaveSetup}
              isRawBtTesting={isRawBtTesting}
              rawBtTestFeedback={rawBtTestFeedback}
              rawBtTestOk={rawBtTestOk}
            />
          )}

          {step === "searching" && (
            <HardwareSearchingStep
              titleKey="hardware.search.lookingForDevices"
              description={t("hardware.search.ensureDeviceOn", {
                device: device.name.toLowerCase(),
              })}
            />
          )}

          {step === "found" && (
            <HardwareDeviceListStep
              devices={availableDevices}
              foundTitle={foundTitle}
              notFoundPromptKey="hardware.found.dontSeeDevice"
              onSelect={connectDevice}
              onRescan={searchForDevices}
            />
          )}

          {step === "connecting" && (
            <HardwareConnectingStep
              titleKey={
                isPrinter
                  ? "hardware.connecting.testPrintTitle"
                  : "hardware.connecting.title"
              }
              descriptionKey={
                isPrinter
                  ? "hardware.connecting.testPrintDesc"
                  : "hardware.connecting.secureConnection"
              }
            />
          )}

          {step === "success" && (
            <HardwareSuccessStep
              descriptionKey="hardware.success.deviceReady"
              descriptionValues={{ device: device.name.toLowerCase() }}
            />
          )}

          {step === "error" && (
            <HardwareErrorStep
              error={error}
              onTryAgain={searchForDevices}
              onChooseAnother={
                isPrinter ? () => setStep("choice") : undefined
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
