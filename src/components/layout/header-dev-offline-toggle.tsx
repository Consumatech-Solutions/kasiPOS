"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

type HeaderDevOfflineToggleProps = {
  mounted: boolean;
};

export function HeaderDevOfflineToggle({
  mounted,
}: Readonly<HeaderDevOfflineToggleProps>) {
  const [visible, setVisible] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);

  useEffect(() => {
    if (!mounted || process.env.NODE_ENV !== "development") {
      setVisible(false);
      return;
    }

    let cancelled = false;

    void import("@/lib/offline-detector").then(({ offlineDetector }) => {
      if (cancelled || !offlineDetector.isDevHost()) return;
      setVisible(true);
      setForceOffline(offlineDetector.getForceOffline());
    });

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  if (!visible) return null;

  const handleToggle = (checked: boolean) => {
    setForceOffline(checked);
    void import("@/lib/offline-detector").then(({ offlineDetector }) => {
      offlineDetector.setForceOffline(checked);
    });
  };

  return (
    <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
      <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
        Simulate offline
      </span>
      <Switch
        checked={forceOffline}
        onCheckedChange={handleToggle}
        aria-label="Simulate offline"
      />
    </div>
  );
}
