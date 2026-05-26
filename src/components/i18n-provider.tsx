"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSettings } from "@/components/settings-provider";
import { getMessages } from "@/i18n/messages";
import { translate } from "@/i18n/translate";
import type { MessageParams } from "@/i18n/types";
import { resolveLocale, type SupportedLocale } from "@/i18n/types";

type TranslateFn = (key: string, params?: MessageParams) => string;

interface I18nContextValue {
  locale: SupportedLocale;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const locale = resolveLocale(settings.language);
  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback<TranslateFn>(
    (key, params) => translate(messages, key, params),
    [messages]
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
