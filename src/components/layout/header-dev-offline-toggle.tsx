"use client";

import { Switch } from "@/components/ui/switch";
import { offlineDetector } from "@/lib/offline-detector";

type HeaderDevOfflineToggleProps = {
  mounted: boolean;
};

export function HeaderDevOfflineToggle({
  mounted,
}: HeaderDevOfflineToggleProps) {
  if (
    !mounted ||
    process.env.NODE_ENV !== "development" ||
    !offlineDetector.isDevHost()
  ) {
    return null;
  }

  return (
    <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
      <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
        Simulate offline
      </span>
      <Switch
        checked={offlineDetector.getForceOffline()}
        onCheckedChange={(checked) => offlineDetector.setForceOffline(checked)}
        aria-label="Simulate offline"
      />
    </div>
  );
}
