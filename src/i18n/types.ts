import type { AppSettings } from "@/types";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(language: AppSettings["language"]): SupportedLocale {
  return language === "fr" ? "fr" : "en";
}

export type MessageParams = Record<string, string | number>;
