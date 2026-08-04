"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { StoreCurrency } from "@/types";
import type { ExchangeRateKey } from "@/lib/currency-conversion";

const PAYMENT_CURRENCIES: StoreCurrency[] = ["USD", "CDF", "ZAR"];

interface PaymentCurrencySelectProps {
  value: StoreCurrency;
  storeCurrency: StoreCurrency;
  onChange: (currency: StoreCurrency) => void;
  missingRate: ExchangeRateKey | null;
  disabled?: boolean;
}

export function PaymentCurrencySelect({
  value,
  storeCurrency,
  onChange,
  missingRate,
  disabled = false,
}: PaymentCurrencySelectProps) {
  const { t } = useTranslation();

  const rateLabel =
    missingRate === "cdfUsdExRate"
      ? t("pos.paymentCurrency.rateCdf")
      : missingRate === "zarUsdExRate"
        ? t("pos.paymentCurrency.rateZar")
        : null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="payment-currency">
          {t("pos.paymentCurrency.label")}
        </Label>
        <Select
          value={value}
          onValueChange={(v) => onChange(v as StoreCurrency)}
          disabled={disabled}
        >
          <SelectTrigger id="payment-currency" className="min-h-[44px]">
            <SelectValue placeholder={t("pos.paymentCurrency.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {t(`pos.paymentCurrency.options.${code.toLowerCase()}`, {
                  defaultValue: code,
                })}
                {code === storeCurrency
                  ? ` (${t("pos.paymentCurrency.storeDefault")})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("pos.paymentCurrency.hint", {
            storeCurrency,
          })}
        </p>
      </div>

      {missingRate && rateLabel ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("pos.paymentCurrency.missingRateTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {t("pos.paymentCurrency.missingRateDesc", {
                rate: rateLabel,
              })}
            </p>
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] touch-target"
            >
              <Link href="/settings">
                {t("pos.paymentCurrency.goToSettings")}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
