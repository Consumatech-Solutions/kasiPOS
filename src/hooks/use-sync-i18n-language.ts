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
    const root = document.documentElement;
    root.lang = code;
    // Browser Translate rewrites text nodes and crashes React's removeChild
    // on language switches / list updates (login, signup, catalogue).
    root.setAttribute("translate", "no");
    root.classList.add("notranslate");
    document.body?.setAttribute("translate", "no");
    document.body?.classList.add("notranslate");
  }, [language, hasHydratedStorage]);
}
