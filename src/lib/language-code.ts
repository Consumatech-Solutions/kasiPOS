import type { AppSettings } from "@/types";

const APP_LANGUAGE_CODES = [
  "en",
  "fr",
  "sw",
  "zu",
  "so",
  "am",
] as const satisfies readonly AppSettings["language"][];

function isAppLanguage(value: string): value is AppSettings["language"] {
  return (APP_LANGUAGE_CODES as readonly string[]).includes(value);
}

/** Restore language from localStorage; invalid or missing values become `"en"`. */
export function parseStoredAppLanguage(raw: unknown): AppSettings["language"] {
  if (typeof raw === "string" && isAppLanguage(raw)) {
    return raw;
  }
  return "en";
}

/**
 * Map stored / API language codes to an i18next bundle we ship (`en` | `fr`).
 * Unsupported codes fall back to English until those locales are added.
 */
export function normalizeToSupportedI18nLng(code: string): "en" | "fr" {
  return code === "fr" ? "fr" : "en";
}
