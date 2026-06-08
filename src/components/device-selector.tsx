"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Usb,
  Laptop2,
} from "lucide-react";
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

type ModalStep = "searching" | "found" | "connecting" | "success" | "error";

function getConnectionTypeLabel(
  ct: Device["connectionType"],
  t: (key: string) => string
): string {
  if (ct === "webusb") return t("hardware.connectionType.webusb");
  if (ct === "webhid") return t("hardware.connectionType.webhid");
  if (ct === "qz") return t("hardware.connectionType.qz");
  return t("hardware.connectionType.server");
}

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
}: DeviceSelectorProps) {
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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
        <DialogHeader className="px-2 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl">
            {t("hardware.deviceSelector.connectTitle", {
              type: getTypeLabel(),
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
          {step === "searching" && (
            <div className="animate-in fade-in duration-300 flex flex-col items-center">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-primary/10 p-4 sm:p-6 rounded-full">
                  <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
                </div>
              </div>
              <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 px-4">
                {t("hardware.search.lookingForDevices")}
              </h4>
              <p className="text-sm sm:text-base text-slate-500 px-4">
                {t("hardware.search.ensureDeviceOn", {
                  device: getTypeLabel().toLowerCase(),
                })}
              </p>
            </div>
          )}

          {step === "found" && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
              <div className="text-left mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {devices.length === 1
                    ? t("hardware.found.device")
                    : t("hardware.found.devices", { count: devices.length })}
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {devices.map((deviceItem) => (
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
                {t("hardware.connecting.title")}
              </h4>
              <p className="text-sm sm:text-base text-slate-500">
                {t("hardware.connecting.secureConnection")}
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
              <p className="text-sm sm:text-base text-slate-500">
                {t("hardware.success.deviceReady", {
                  device: getTypeLabel().toLowerCase(),
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
              <p className="text-sm sm:text-base text-slate-500 mb-4 text-center">
                {error}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {canRequestDevice && (
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
                )}
                <Button
                  onClick={searchForDevices}
                  variant="outline"
                  className="min-h-[44px] touch-target w-full sm:w-auto"
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
}
