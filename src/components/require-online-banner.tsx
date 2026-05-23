"use client";

import { useTranslation } from "react-i18next";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WifiOff } from "lucide-react";

export function RequireOnlineBanner() {
  const { t } = useTranslation();
  const { isOnline, hasInternet } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <Alert
      variant="default"
      className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-400/50"
    >
      <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>
        {hasInternet
          ? t("requireOnlineBanner.cloudTitle")
          : t("requireOnlineBanner.offlineTitle")}
      </AlertTitle>
      <AlertDescription>
        {hasInternet
          ? t("requireOnlineBanner.cloudDescription")
          : t("requireOnlineBanner.offlineDescription")}
      </AlertDescription>
    </Alert>
  );
}
