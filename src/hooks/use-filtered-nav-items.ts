"use client";

import { useMemo } from "react";
import { navItems as allNavItems } from "@/lib/nav-config";
import { useSettings } from "@/components/settings-provider";

export function useFilteredNavItems() {
  const { settings } = useSettings();

  return useMemo(() => {
    const userRole = settings.currentUser?.role;
    return allNavItems.filter((item) => {
      if (item.featureFlag && !settings[item.featureFlag]) {
        return false;
      }
      if (item.roles && (!userRole || !item.roles.includes(userRole))) {
        return false;
      }
      return true;
    });
  }, [settings]);
}
