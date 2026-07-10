"use client";

import dynamic from "next/dynamic";
import SettingsLoading from "./loading";

const SettingsPageContent = dynamic(
  () => import("@/components/settings/settings-page-content"),
  {
    loading: () => <SettingsLoading />,
    ssr: false,
  }
);

export default function SettingsPage() {
  return <SettingsPageContent />;
}
