import type { SupportedLocale } from "../types";
import { en, type MessageCatalog } from "./en";
import { fr } from "./fr";

const catalogs: Record<SupportedLocale, MessageCatalog> = {
  en,
  fr,
};

export function getMessages(locale: SupportedLocale): MessageCatalog {
  return catalogs[locale] ?? en;
}

export { en, fr };
export type { MessageCatalog };
