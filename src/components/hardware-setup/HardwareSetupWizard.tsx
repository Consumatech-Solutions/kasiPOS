"use client";

import React, { useState, useEffect } from "react";
import { Printer, ScanBarcode, CreditCard } from "lucide-react";
import { HardwareDevice, ConnectionStatus } from "./types";
import { DeviceCard } from "./DeviceCard";
import { ConnectionModal } from "./ConnectionModal";
import { PrinterSetupModal } from "./PrinterSetupModal";
import { getStoredDevice, getPrinterMode } from "@/lib/device-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HardwareSetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const INITIAL_DEVICES: Omit<HardwareDevice, "status" | "deviceId">[] = [
  {
    id: "printer",
    name: "Receipt Printer",
    icon: Printer,
  },
  {
    id: "scanner",
    name: "Barcode Scanner",
    icon: ScanBarcode,
  },
  {
    id: "reader",
    name: "Card Reader",
    icon: CreditCard,
  },
];

export const HardwareSetupWizard: React.FC<HardwareSetupWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<HardwareDevice | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkStoredDevices = () => {
      const updatedDevices = INITIAL_DEVICES.map((device) => {
        const serviceType =
          device.id === "printer"
            ? "printer"
            : device.id === "scanner"
              ? "scanner"
              : "pos";
        const storedDeviceId = getStoredDevice(serviceType);
        const isPrinterConnected =
          device.id === "printer" &&
          (!!storedDeviceId || getPrinterMode() === "browser");
        const isConnected =
          device.id === "printer" ? isPrinterConnected : !!storedDeviceId;

        const deviceId =
          device.id === "printer"
            ? storedDeviceId ||
              (getPrinterMode() === "browser" ? "browser" : undefined)
            : storedDeviceId || undefined;

        return {
          ...device,
          status: (isConnected
            ? "connected"
            : "disconnected") as ConnectionStatus,
          deviceId,
        };
      });

      setDevices(updatedDevices);
    };

    checkStoredDevices();
  }, []);

  const handleDeviceClick = (device: HardwareDevice) => {
    if (device.status !== "connected") {
      setSelectedDevice(device);
      setIsModalOpen(true);
    }
  };

  const handleConnectSuccess = (
    deviceId: string,
    deviceType: "printer" | "scanner" | "pos",
  ) => {
    setDevices((prevDevices) =>
      prevDevices.map((d) => {
        const matchesType =
          (d.id === "printer" && deviceType === "printer") ||
          (d.id === "scanner" && deviceType === "scanner") ||
          (d.id === "reader" && deviceType === "pos");

        return matchesType
          ? { ...d, status: "connected" as ConnectionStatus, deviceId }
          : d;
      }),
    );
    setSelectedDevice(null);
  };

  const handleSaveAndContinue = () => {
    onComplete();
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-5xl w-full my-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4 sm:pb-8 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">
              Set up your hardware
            </CardTitle>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              Connect your receipt printer, barcode scanner, and card reader to
              start selling.
            </p>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 md:p-8 lg:p-12">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-12">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
                  >
                    <DeviceCard device={device} onClick={handleDeviceClick} />
                  </div>
                ))}
              </div>

              <div className="text-center mb-8 sm:mb-12 md:mb-16">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="px-6 py-2.5 min-h-[44px] touch-target w-full sm:w-auto"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </CardContent>

          <div className="border-t p-4 sm:p-6 md:px-12 flex justify-end items-center bg-muted/30">
            <Button
              onClick={handleSaveAndContinue}
              className="px-6 sm:px-8 py-2.5 sm:py-3 min-h-[44px] touch-target w-full sm:w-auto text-sm sm:text-base"
            >
              Save & Continue
            </Button>
          </div>
        </Card>

        <p className="text-center text-muted-foreground text-xs sm:text-sm mt-4 sm:mt-8 px-4">
          Need help connecting?{" "}
          <a href="#" className="text-primary hover:underline">
            View setup guide
          </a>
        </p>
      </div>

      {selectedDevice?.id === "printer" ? (
        <PrinterSetupModal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDevice(null);
          }}
          onSuccess={(deviceId) => handleConnectSuccess(deviceId, "printer")}
        />
      ) : selectedDevice ? (
        <ConnectionModal
          device={selectedDevice}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDevice(null);
          }}
          onConnect={handleConnectSuccess}
        />
      ) : null}
    </div>
  );
};
