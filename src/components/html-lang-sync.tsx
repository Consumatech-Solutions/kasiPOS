"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";

export function HtmlLangSync() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
