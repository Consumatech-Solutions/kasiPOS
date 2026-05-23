"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enApp from "@/locales/en/app.json";
import enCommon from "@/locales/en/common.json";
import enSettings from "@/locales/en/settings.json";
import enPos from "@/locales/en/pos.json";
import enCatalogue from "@/locales/en/catalogue.json";
import enInventory from "@/locales/en/inventory.json";
import enSales from "@/locales/en/sales.json";
import enTransactions from "@/locales/en/transactions.json";
import enCustomers from "@/locales/en/customers.json";
import enBuyStock from "@/locales/en/buyStock.json";
import enVouchers from "@/locales/en/vouchers.json";
import enMarketplace from "@/locales/en/marketplace.json";
import frApp from "@/locales/fr/app.json";
import frCommon from "@/locales/fr/common.json";
import frSettings from "@/locales/fr/settings.json";
import frPos from "@/locales/fr/pos.json";
import frCatalogue from "@/locales/fr/catalogue.json";
import frInventory from "@/locales/fr/inventory.json";
import frSales from "@/locales/fr/sales.json";
import frTransactions from "@/locales/fr/transactions.json";
import frCustomers from "@/locales/fr/customers.json";
import frBuyStock from "@/locales/fr/buyStock.json";
import frVouchers from "@/locales/fr/vouchers.json";
import frMarketplace from "@/locales/fr/marketplace.json";
import {
  normalizeToSupportedI18nLng,
  parseStoredAppLanguage,
} from "@/lib/language-code";

function readInitialLngFromStorage(): "en" | "fr" {
  if (typeof window === "undefined") {
    return "en";
  }
  try {
    const raw = window.localStorage.getItem("kasi-pos-settings");
    if (!raw) {
      return "en";
    }
    const parsed = JSON.parse(raw) as { language?: unknown };
    const appLang = parseStoredAppLanguage(parsed.language);
    return normalizeToSupportedI18nLng(appLang);
  } catch {
    return "en";
  }
}

const enTranslation = {
  ...enCommon,
  ...enApp,
  ...enSettings,
  ...enPos,
  ...enCatalogue,
  ...enInventory,
  ...enSales,
  ...enTransactions,
  ...enCustomers,
  ...enBuyStock,
  ...enVouchers,
  ...enMarketplace,
};
const frTranslation = {
  ...frCommon,
  ...frApp,
  ...frSettings,
  ...frPos,
  ...frCatalogue,
  ...frInventory,
  ...frSales,
  ...frTransactions,
  ...frCustomers,
  ...frBuyStock,
  ...frVouchers,
  ...frMarketplace,
};

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: enTranslation },
      fr: { translation: frTranslation },
    },
    lng: readInitialLngFromStorage(),
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
