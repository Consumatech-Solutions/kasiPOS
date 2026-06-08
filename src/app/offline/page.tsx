"use client";

import { useTranslation } from "react-i18next";

export default function OfflinePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {t("onboarding.offline.title")}
      </h1>
      <p className="text-muted-foreground mb-4">
        {t("onboarding.offline.description")}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {t("onboarding.offline.retry")}
      </button>
    </div>
  );
}
