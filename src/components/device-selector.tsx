"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getDevices, storeDevice, type Device } from "@/lib/device-service";
import {
  requestWebUSBPrinter,
  isWebUSBAvailable,
  createWebUSBDeviceId,
} from "@/lib/webusb-printer";
import {
  requestWebHIDScanner,
  isWebHIDAvailable,
  createWebHIDDeviceId,
} from "@/lib/webhid-scanner";
import { useTranslation } from "react-i18next";
import {
  HardwareConnectingStep,
  HardwareDeviceListStep,
  HardwareErrorStep,
  HardwareSearchingStep,
  HardwareSuccessStep,
} from "@/components/hardware-setup/hardware-ui";

type ModalStep = "searching" | "found" | "connecting" | "success" | "error";

interface DeviceSelectorProps {
  type: "printer" | "scanner" | "pos";
  open: boolean;
  onClose: () => void;
  onSelect: (deviceId: string) => void;
}

export function DeviceSelector({
  type,
  open,
  onClose,
  onSelect,
}: Readonly<DeviceSelectorProps>) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>("searching");
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestingDevice, setRequestingDevice] = useState(false);

  const isWebUSBSupported = isWebUSBAvailable();
  const isWebHIDSupported = isWebHIDAvailable();
  const canRequestDevice =
    ((type === "printer" || type === "pos") && isWebUSBSupported) ||
    (type === "scanner" && isWebHIDSupported);

  const getTypeLabel = () => {
    switch (type) {
      case "printer":
        return t("hardware.deviceSelector.typePrinter");
      case "scanner":
        return t("hardware.deviceSelector.typeScanner");
      case "pos":
        return t("hardware.deviceSelector.typePos");
      default:
        return t("hardware.deviceSelector.typeDefault");
    }
  };

  useEffect(() => {
    if (open) {
      setStep("searching");
      setError(null);
      setDevices([]);
      searchForDevices();
    } else {
      setDevices([]);
      setError(null);
    }
  }, [open, type]);

  const searchForDevices = async () => {
    try {
      setStep("searching");
      setError(null);

      const searchStartTime = Date.now();
      const deviceList = await getDevices(type);
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500;

      if (searchDuration < minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDelay - searchDuration)
        );
      }

      if (deviceList.length === 0) {
        setStep("error");
        setError(
          t("hardware.deviceSelector.noDevices", {
            type: getTypeLabel().toLowerCase(),
          })
        );
        return;
      }

      setDevices(deviceList);
      setStep("found");
    } catch (err: any) {
      console.error("Error searching for devices:", err);
      setStep("error");
      setError(err.message || t("hardware.deviceSelector.searchFailed"));
    }
  };

  const connectDevice = async (deviceId: string) => {
    try {
      setStep("connecting");
      setError(null);

      const selectedDevice = devices.find((d) => d.id === deviceId);

      if (!selectedDevice) {
        throw new Error(t("hardware.deviceSelector.deviceNotFound"));
      }

      storeDevice(type, deviceId, selectedDevice.connectionType);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStep("success");

      setTimeout(() => {
        onSelect(deviceId);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Error connecting device:", err);
      setStep("error");
      setError(err.message || t("hardware.deviceSelector.connectFailed"));
    }
  };

  const handleRequestDevice = async () => {
    setRequestingDevice(true);
    setError(null);
    try {
      if ((type === "printer" || type === "pos") && isWebUSBSupported) {
        const device = await requestWebUSBPrinter();
        const deviceId = createWebUSBDeviceId(device);
        const newDevice: Device = {
          id: deviceId,
          type: "printer",
          connection: "usb",
          connectionType: "webusb",
          name:
            device.productName ||
            t("hardware.deviceSelector.printerFallback", {
              vid: device.vendorId.toString(16),
              pid: device.productId.toString(16),
            }),
          vendorId: device.vendorId,
          productId: device.productId,
          manufacturer: (device as any).manufacturerName,
          product: device.productName,
          serialNumber: (device as any).serialNumber,
          connected: device.opened,
        };
        setDevices([...devices, newDevice]);
        connectDevice(deviceId);
      } else if (type === "scanner" && isWebHIDSupported) {
        const device = await requestWebHIDScanner();
        const deviceId = createWebHIDDeviceId(device);
        const newDevice: Device = {
          id: deviceId,
          type: "scanner",
          connection: "usb",
          connectionType: "webhid",
          name:
            device.productName ||
            t("hardware.deviceSelector.scannerFallback", {
              vid: device.vendorId.toString(16),
              pid: device.productId.toString(16),
            }),
          vendorId: device.vendorId,
          productId: device.productId,
          manufacturer: (device as any).manufacturerName,
          product: device.productName,
          serialNumber: (device as any).serialNumber,
          connected: device.opened,
        };
        setDevices([...devices, newDevice]);
        connectDevice(deviceId);
      }
    } catch (err: any) {
      setError(err.message || t("hardware.deviceSelector.requestFailed"));
      setStep("error");
    } finally {
      setRequestingDevice(false);
    }
  };

  const typeLabel = getTypeLabel();
  const foundTitle =
    devices.length === 1
      ? t("hardware.found.device")
      : t("hardware.found.devices", { count: devices.length });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
        <DialogHeader className="px-2 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl">
            {t("hardware.deviceSelector.connectTitle", { type: typeLabel })}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
          {step === "searching" && (
            <HardwareSearchingStep
              titleKey="hardware.search.lookingForDevices"
              description={t("hardware.search.ensureDeviceOn", {
                device: typeLabel.toLowerCase(),
              })}
            />
          )}

          {step === "found" && (
            <HardwareDeviceListStep
              devices={devices}
              foundTitle={foundTitle}
              notFoundPromptKey="hardware.found.dontSeeDevice"
              onSelect={connectDevice}
              onRescan={searchForDevices}
            />
          )}

          {step === "connecting" && (
            <HardwareConnectingStep
              titleKey="hardware.connecting.title"
              descriptionKey="hardware.connecting.secureConnection"
            />
          )}

          {step === "success" && (
            <HardwareSuccessStep
              descriptionKey="hardware.success.deviceReady"
              descriptionValues={{ device: typeLabel.toLowerCase() }}
            />
          )}

          {step === "error" && (
            <HardwareErrorStep
              error={error}
              onTryAgain={searchForDevices}
              actionLayout="column"
              extraActions={
                canRequestDevice ? (
                  <Button
                    variant="outline"
                    onClick={handleRequestDevice}
                    disabled={requestingDevice}
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                  >
                    {requestingDevice ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("hardware.deviceSelector.requestDevice")}
                  </Button>
                ) : null
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
