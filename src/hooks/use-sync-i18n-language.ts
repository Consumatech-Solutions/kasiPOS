"use client";

import { useEffect } from "react";
import i18n from "@/lib/i18n";
import { normalizeToSupportedI18nLng } from "@/lib/language-code";
import type { AppSettings } from "@/types";

export function useSyncI18nLanguage(
  language: AppSettings["language"],
  hasHydratedStorage: boolean
) {
  useEffect(() => {
    if (!hasHydratedStorage) return;
    const code = normalizeToSupportedI18nLng(language);
    void i18n.changeLanguage(code);
    document.documentElement.lang = code;
  }, [language, hasHydratedStorage]);
}
