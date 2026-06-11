"use client";

import React from "react";
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
import { Button } from "@/components/ui/button";
import { RAWBT_PLAY_STORE_URL } from "@/lib/rawbt-print";
import type { Device } from "@/lib/device-service";
import type { PrintStrategy } from "@/lib/platform";
import { useTranslation } from "react-i18next";

export const QZ_TRAY_DOWNLOAD_URL = "https://qz.io/download/";

export function getConnectionTypeLabel(
  ct: Device["connectionType"],
  t: (key: string) => string
): string {
  if (ct === "webusb") return t("hardware.connectionType.webusb");
  if (ct === "webhid") return t("hardware.connectionType.webhid");
  if (ct === "qz") return t("hardware.connectionType.qz");
  return t("hardware.connectionType.server");
}

function DeviceConnectionIcon({
  connectionType,
}: {
  connectionType: Device["connectionType"];
}) {
  const iconClass =
    "sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary";
  if (connectionType === "webusb" || connectionType === "webhid") {
    return <Usb size={18} className={iconClass} />;
  }
  return <Wifi size={18} className={iconClass} />;
}

export interface PrinterConnectionChoiceProps {
  printStrategy: PrintStrategy;
  onBrowserPrint: () => void;
  onFindQzPrinter: () => void;
  onSearchWebUsb: () => void;
  onRawBtTest: () => void;
  onRawBtSave: () => void;
  isRawBtTesting: boolean;
  rawBtTestFeedback: string | null;
  rawBtTestOk: boolean | null;
}

export function PrinterConnectionChoice({
  printStrategy,
  onBrowserPrint,
  onFindQzPrinter,
  onSearchWebUsb,
  onRawBtTest,
  onRawBtSave,
  isRawBtTesting,
  rawBtTestFeedback,
  rawBtTestOk,
}: PrinterConnectionChoiceProps) {
  const { t } = useTranslation();

  return (
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
                onClick={onFindQzPrinter}
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
              onClick={onSearchWebUsb}
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
              onClick={onRawBtTest}
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
              onClick={onRawBtSave}
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
          onClick={onBrowserPrint}
        >
          <Monitor className="mr-2 h-4 w-4" />
          {t("hardware.choice.useBrowserPrint")}
        </Button>
      </div>
    </div>
  );
}

export function HardwareSearchingStep({
  titleKey,
  description,
}: {
  titleKey: string;
  description: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="animate-in fade-in duration-300 flex flex-col items-center">
      <div className="relative mb-4 sm:mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
        <div className="relative bg-primary/10 p-4 sm:p-6 rounded-full">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
        </div>
      </div>
      <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 px-4">
        {t(titleKey)}
      </h4>
      <p className="text-sm text-slate-500 px-4">{description}</p>
    </div>
  );
}

export function HardwareDeviceListStep({
  devices,
  foundTitle,
  notFoundPromptKey,
  onSelect,
  onRescan,
}: {
  devices: Device[];
  foundTitle: string;
  notFoundPromptKey: string;
  onSelect: (deviceId: string) => void;
  onRescan: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
      <div className="text-left mb-4">
        <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {foundTitle}
        </h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {devices.map((deviceItem) => (
            <button
              key={deviceItem.id}
              type="button"
              onClick={() => onSelect(deviceItem.id)}
              className="w-full group flex items-center justify-between p-3 sm:p-4 border border-slate-200 rounded-xl active:border-primary active:shadow-md active:bg-primary/5 sm:hover:border-primary sm:hover:shadow-md sm:hover:bg-primary/5 transition-all cursor-pointer bg-white touch-target min-h-[60px]"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-active:bg-primary/10 sm:group-hover:bg-primary/10 transition-colors">
                  <DeviceConnectionIcon
                    connectionType={deviceItem.connectionType}
                  />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-slate-900 group-active:text-primary sm:group-hover:text-primary truncate">
                    {deviceItem.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {getConnectionTypeLabel(deviceItem.connectionType, t)} •{" "}
                    {t("hardware.found.readyToPair")}
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
        {t(notFoundPromptKey)}{" "}
        <button
          type="button"
          onClick={onRescan}
          className="text-primary active:underline sm:hover:underline touch-target min-h-[44px]"
        >
          {t("hardware.found.scanAgain")}
        </button>
      </p>
    </div>
  );
}

export function HardwareConnectingStep({
  titleKey,
  descriptionKey,
}: {
  titleKey: string;
  descriptionKey: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
      <div className="mb-4 sm:mb-6 relative">
        <Laptop2 className="w-14 h-14 sm:w-16 sm:h-16 text-slate-300" />
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
        </div>
      </div>
      <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2">
        {t(titleKey)}
      </h4>
      <p className="text-sm text-slate-500">{t(descriptionKey)}</p>
    </div>
  );
}

export function HardwareSuccessStep({
  descriptionKey,
  descriptionValues,
}: {
  descriptionKey: string;
  descriptionValues?: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center px-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
        <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
      </div>
      <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
        {t("hardware.success.title")}
      </h4>
      <p className="text-sm text-slate-500">
        {t(descriptionKey, descriptionValues)}
      </p>
    </div>
  );
}

export function HardwareErrorStep({
  error,
  onTryAgain,
  onChooseAnother,
  extraActions,
  actionLayout = "row",
}: {
  error: string | null;
  onTryAgain: () => void;
  onChooseAnother?: () => void;
  extraActions?: React.ReactNode;
  actionLayout?: "row" | "column";
}) {
  const { t } = useTranslation();
  const layoutClass =
    actionLayout === "column"
      ? "flex flex-col sm:flex-row gap-2 w-full sm:w-auto"
      : "flex flex-wrap gap-2 justify-center";

  return (
    <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
        <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
      </div>
      <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
        {t("hardware.error.connectionFailed")}
      </h4>
      <p className="text-sm text-slate-500 mb-4 text-center">{error}</p>
      <div className={layoutClass}>
        {extraActions}
        {onChooseAnother ? (
          <Button
            variant="outline"
            onClick={onChooseAnother}
            className="min-h-[44px] touch-target"
          >
            {t("hardware.error.chooseAnotherMethod")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={onTryAgain}
          className="min-h-[44px] touch-target w-full sm:w-auto"
        >
          {t("hardware.error.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
