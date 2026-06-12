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
import enBoph from "@/locales/en/boph.json";
import enAuth from "@/locales/en/auth.json";
import enOnboarding from "@/locales/en/onboarding.json";
import enReports from "@/locales/en/reports.json";
import enPrintTest from "@/locales/en/printTest.json";
import enPayment from "@/locales/en/payment.json";
import enHardware from "@/locales/en/hardware.json";
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
import frBoph from "@/locales/fr/boph.json";
import frAuth from "@/locales/fr/auth.json";
import frOnboarding from "@/locales/fr/onboarding.json";
import frReports from "@/locales/fr/reports.json";
import frPrintTest from "@/locales/fr/printTest.json";
import frPayment from "@/locales/fr/payment.json";
import frHardware from "@/locales/fr/hardware.json";
function mergeLocaleBundles(
  ...bundles: Record<string, string>[]
): Record<string, string> {
  return Object.assign({}, ...bundles);
}

const enTranslation = mergeLocaleBundles(
  enCommon,
  enApp,
  enSettings,
  enPos,
  enCatalogue,
  enInventory,
  enSales,
  enTransactions,
  enCustomers,
  enBuyStock,
  enVouchers,
  enMarketplace,
  enBoph,
  enAuth,
  enOnboarding,
  enReports,
  enPrintTest,
  enPayment,
  enHardware
);
const frTranslation = mergeLocaleBundles(
  frCommon,
  frApp,
  frSettings,
  frPos,
  frCatalogue,
  frInventory,
  frSales,
  frTransactions,
  frCustomers,
  frBuyStock,
  frVouchers,
  frMarketplace,
  frBoph,
  frAuth,
  frOnboarding,
  frReports,
  frPrintTest,
  frPayment,
  frHardware
);

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: enTranslation },
      fr: { translation: frTranslation },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    react: { useSuspense: false },
  });
}

export default i18n;
