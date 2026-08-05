"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Transaction, TransactionItem, Customer, StoreCurrency } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Phone,
  Loader2,
  CreditCard,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react";
import { DeviceSelector } from "@/components/device-selector";
import { getStoredDevice, connectPos } from "@/lib/device-service";
import { useToast } from "@/hooks/use-toast";
import {
  appendTenderedKey,
  sanitizeTenderedInput,
} from "@/lib/payment-tendered-input";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { formatMoney, getCurrencySymbol } from "@/lib/format-money";
import { CurrencyConversionHint } from "@/components/currency-conversion-hint";
import { PaymentCurrencySelect } from "@/components/pos/PaymentCurrencySelect";
import {
  convertCurrency,
  getMissingExchangeRate,
} from "@/lib/currency-conversion";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: "Cash" | "Card" | "Mobile Money" | null;
  cartTotal: number;
  cartItems: TransactionItem[];
  onCompleteSale: (
    transaction: Omit<Transaction, "id" | "date" | "storeId">
  ) => void;
  customer: Customer | null | undefined;
  isLoading?: boolean;
}

const mobileMoneyOptions = [
  "MTN MoMo",
  "Vodacom VodaPay",
  "InstantMoney (Standard Bank)",
  "eWallet (FNB)",
  "CashSend (ABSA)",
  "Imali (Nedbank)",
];

export default function PaymentModal({
  isOpen,
  onClose,
  method,
  cartTotal,
  cartItems,
  onCompleteSale,
  customer,
  isLoading = false,
}: PaymentModalProps) {
  const { t } = useTranslation();
  const [tendered, setTendered] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedMobileProvider, setSelectedMobileProvider] = useState("");
  const [showPosDeviceSelector, setShowPosDeviceSelector] = useState(false);
  const [posConnected, setPosConnected] = useState(false);
  const [isConnectingPos, setIsConnectingPos] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState<StoreCurrency>("USD");
  const { toast } = useToast();
  const {
    currency: storeCurrency,
    cdfUsdExRate,
    zarUsdExRate,
  } = useStoreCurrency();
  const rates = useMemo(
    () => ({ cdfUsdExRate, zarUsdExRate }),
    [cdfUsdExRate, zarUsdExRate]
  );

  const missingRate = getMissingExchangeRate(
    storeCurrency,
    paymentCurrency,
    rates
  );
  const amountDueInPaymentCurrency = convertCurrency(
    cartTotal,
    storeCurrency,
    paymentCurrency,
    rates
  );
  const canConvert =
    paymentCurrency === storeCurrency ||
    (missingRate == null && amountDueInPaymentCurrency != null);

  const paymentCurrencySymbol = getCurrencySymbol(paymentCurrency);
  const formatPayment = useCallback(
    (amount: number) => formatMoney(amount, paymentCurrency),
    [paymentCurrency]
  );
  const formatStore = useCallback(
    (amount: number) => formatMoney(amount, storeCurrency),
    [storeCurrency]
  );

  const tenderedAmount = parseFloat(tendered) || 0;
  const dueInPayment = amountDueInPaymentCurrency ?? cartTotal;
  const change = Math.max(0, tenderedAmount - dueInPayment);
  const canCompleteCashSale =
    canConvert && tenderedAmount >= dueInPayment - 1e-9;
  const isInsufficient =
    canConvert && tenderedAmount > 0 && tenderedAmount < dueInPayment;
  const canCompleteMobileSale =
    canConvert &&
    Boolean(customer?.contact || mobileNumber.length > 10) &&
    Boolean(selectedMobileProvider);

  useEffect(() => {
    if (isOpen) {
      setTendered("");
      setMobileNumber(customer?.contact || "");
      setSelectedMobileProvider("");
      setPosConnected(false);
      setPaymentCurrency(storeCurrency);

      if (method === "Card") {
        const deviceId = getStoredDevice("pos");
        if (deviceId) {
          void handleConnectPos(deviceId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / method changes
  }, [isOpen, method, customer, storeCurrency]);

  const handlePaymentCurrencyChange = (next: StoreCurrency) => {
    setPaymentCurrency(next);
    setTendered("");
  };

  const handleConnectPos = async (deviceId: string) => {
    setIsConnectingPos(true);
    try {
      await connectPos(deviceId);
      setPosConnected(true);
      toast({
        title: t("pos.payment.posConnectedTitle"),
        description: t("pos.payment.posConnectedDesc"),
      });
    } catch (error: unknown) {
      setPosConnected(false);
      const message =
        error instanceof Error ? error.message : t("pos.payment.posFailedDesc");
      toast({
        variant: "destructive",
        title: t("pos.payment.posFailedTitle"),
        description: message,
      });
    } finally {
      setIsConnectingPos(false);
    }
  };

  const handlePosDeviceSelect = async (deviceId: string) => {
    await handleConnectPos(deviceId);
  };

  const handleClear = useCallback(() => setTendered(""), []);
  const handleBackspace = useCallback(
    () => setTendered((prev) => prev.slice(0, -1)),
    []
  );

  const handleKeyPress = useCallback((key: string) => {
    setTendered((prev) => appendTenderedKey(prev, key));
  }, []);

  const handleCompleteCashSale = useCallback(() => {
    if (isLoading || !canCompleteCashSale || !canConvert) return;
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: "Cash",
    });
  }, [
    isLoading,
    canCompleteCashSale,
    canConvert,
    onCompleteSale,
    cartItems,
    cartTotal,
  ]);

  const canCompleteCashSaleRef = useRef(canCompleteCashSale);
  canCompleteCashSaleRef.current = canCompleteCashSale;
  const handleCompleteCashSaleRef = useRef(handleCompleteCashSale);
  handleCompleteCashSaleRef.current = handleCompleteCashSale;

  useEffect(() => {
    if (!isOpen || method !== "Cash") return;

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isLoading) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;

      const target = event.target;
      const targetId = target instanceof HTMLElement ? target.id : undefined;

      if (targetId === "tendered") {
        if (event.key === "Enter" && canCompleteCashSaleRef.current) {
          event.preventDefault();
          handleCompleteCashSaleRef.current();
        }
        return;
      }

      if (isEditableTarget(target)) return;

      const key = event.key;
      if (key === "Enter") {
        if (canCompleteCashSaleRef.current) {
          event.preventDefault();
          handleCompleteCashSaleRef.current();
        }
        return;
      }

      if (key === "Backspace") {
        event.preventDefault();
        handleBackspace();
        return;
      }

      if (key === "Delete") {
        event.preventDefault();
        handleClear();
        return;
      }

      if (/^\d$/.test(key) || key === ".") {
        event.preventDefault();
        handleKeyPress(key);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, method, isLoading, handleBackspace, handleClear, handleKeyPress]);

  const handlePlaceholderComplete = () => {
    if (isLoading || !method || !canConvert) return;
    if (method === "Mobile Money" && !canCompleteMobileSale) return;
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: method,
    });
  };

  const currencySelector = (
    <div className="mb-4">
      <PaymentCurrencySelect
        value={paymentCurrency}
        storeCurrency={storeCurrency}
        onChange={handlePaymentCurrencyChange}
        missingRate={missingRate}
        disabled={isLoading}
      />
    </div>
  );

  const renderContent = () => {
    switch (method) {
      case "Cash": {
        const quickBills = [50, 100, 200];
        const keypadKeys = [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          ".",
          "0",
        ];

        const cashSummary = (
          <>
            <div className="space-y-4 text-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("pos.paymentCurrency.storeTotal", {
                    currency: storeCurrency,
                  })}
                  :
                </span>
                <div className="text-right">
                  <span className="font-bold">{formatStore(cartTotal)}</span>
                  {paymentCurrency === storeCurrency ? (
                    <CurrencyConversionHint
                      amount={cartTotal}
                      className="mt-1"
                    />
                  ) : null}
                </div>
              </div>
              {paymentCurrency !== storeCurrency && canConvert ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("pos.paymentCurrency.amountDueIn", {
                      currency: paymentCurrency,
                    })}
                    :
                  </span>
                  <span className="font-bold text-primary">
                    {formatPayment(dueInPayment)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("pos.payment.items")}:
                </span>
                <span className="font-bold">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
            </div>
            <Separator className="my-6" />
            <div className="space-y-4 text-lg">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {t("pos.payment.tendered")}:
                </span>
                <span className="font-bold text-primary">
                  {formatPayment(tenderedAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {t("pos.payment.change")}:
                </span>
                <span className="font-bold text-green-600">
                  {formatPayment(change)}
                </span>
              </div>
              {tenderedAmount === 0 && canConvert && (
                <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                  {t("pos.payment.noAmountEntered")}
                </p>
              )}
              {isInsufficient && (
                <p className="text-sm text-destructive">
                  {t("pos.payment.insufficient", {
                    amount: formatPayment(dueInPayment - tenderedAmount),
                  })}
                </p>
              )}
            </div>
          </>
        );

        const tenderedInput = (
          <div className="mb-4">
            <label htmlFor="tendered" className="text-sm text-muted-foreground">
              {t("pos.payment.amountTenderedLabel", {
                currency: paymentCurrency,
              })}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                {paymentCurrencySymbol}
              </span>
              <Input
                id="tendered"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={tendered}
                onChange={(e) =>
                  setTendered(sanitizeTenderedInput(e.target.value))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCompleteCashSale) {
                    e.preventDefault();
                    handleCompleteCashSale();
                  }
                }}
                placeholder="0.00"
                className="text-2xl h-14 pl-8 text-right font-mono"
                disabled={isLoading || !canConvert}
                aria-label={t("pos.payment.amountTenderedAria")}
              />
            </div>
          </div>
        );

        const cashFooter = (
          <DialogFooter className="mt-4 gap-2 sm:flex-row flex-col">
            <Button
              type="button"
              variant="secondary"
              className="hidden lg:flex w-full h-14 touch-target"
              onClick={handleClear}
              disabled={isLoading}
            >
              {t("pos.payment.clear")}
            </Button>
            <Button
              type="button"
              className="w-full h-14 touch-target px-4"
              onClick={handleCompleteCashSale}
              disabled={!canCompleteCashSale || isLoading}
              aria-busy={isLoading}
              aria-disabled={!canCompleteCashSale || isLoading}
            >
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
              )}
              {isLoading
                ? t("pos.payment.processing")
                : t("pos.payment.completeSale")}
            </Button>
          </DialogFooter>
        );

        return (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
            <div className="flex flex-col">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl">
                  {t("pos.payment.cashTitle")}
                </DialogTitle>
              </DialogHeader>
              {currencySelector}
              {cashSummary}
            </div>

            <div>
              {tenderedInput}
              <div className="hidden lg:block">
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {quickBills.map((bill) => (
                    <Button
                      key={bill}
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => setTendered(bill.toString())}
                      disabled={isLoading || !canConvert}
                    >
                      {formatPayment(bill)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={() =>
                      setTendered(
                        canConvert
                          ? dueInPayment.toFixed(2)
                          : cartTotal.toFixed(2)
                      )
                    }
                    disabled={isLoading || !canConvert}
                  >
                    {t("pos.payment.exact")}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {keypadKeys.map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      className="h-12 text-xl"
                      onClick={() => handleKeyPress(key)}
                      disabled={isLoading || !canConvert}
                    >
                      {key}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-xl"
                    onClick={handleBackspace}
                    disabled={isLoading || !canConvert}
                  >
                    &larr;
                  </Button>
                </div>
              </div>
              {cashFooter}
            </div>
          </div>
        );
      }
      case "Card": {
        const posDeviceId = getStoredDevice("pos");
        return (
          <div>
            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-2xl">
                {t("pos.payment.cardTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("pos.payment.cardDescription")}
              </DialogDescription>
            </DialogHeader>

            {currencySelector}

            <div className="mb-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-sm">
                      {t("pos.payment.posDevice")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {posDeviceId
                        ? t("pos.payment.deviceSelected")
                        : t("pos.payment.noDeviceSelected")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnectingPos ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t("pos.payment.connecting")}
                      </span>
                    </>
                  ) : posConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        {t("pos.payment.connected")}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t("pos.payment.notConnected")}
                      </span>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPosDeviceSelector(true)}
                    disabled={isConnectingPos}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    {posDeviceId
                      ? t("pos.payment.changeDevice")
                      : t("pos.payment.selectDevice")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="py-8 text-center text-muted-foreground bg-slate-50 rounded-lg">
              <p className="text-4xl font-bold text-foreground">
                {formatStore(cartTotal)}
              </p>
              {paymentCurrency !== storeCurrency && canConvert ? (
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatPayment(dueInPayment)}
                </p>
              ) : (
                <CurrencyConversionHint
                  amount={cartTotal}
                  className="mt-2 justify-center"
                />
              )}
              <p className="mt-2">
                {posConnected
                  ? t("pos.payment.waitingCardMachine")
                  : posDeviceId
                    ? t("pos.payment.connectPosToProcess")
                    : t("pos.payment.selectPosToProcess")}
              </p>
            </div>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full min-h-[44px] touch-target"
                  disabled={isLoading}
                >
                  {t("pos.payment.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handlePlaceholderComplete}
                className="w-full min-h-[44px] touch-target"
                disabled={isLoading || !posConnected || !canConvert}
                aria-busy={isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                )}
                {isLoading
                  ? t("pos.payment.processing")
                  : posConnected
                    ? t("pos.payment.processPayment")
                    : t("pos.payment.connectPosFirst")}
              </Button>
            </DialogFooter>
          </div>
        );
      }
      case "Mobile Money":
        return (
          <div>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">
                {t("pos.payment.mobileTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("pos.payment.mobileDescription")}
              </DialogDescription>
            </DialogHeader>
            {currencySelector}
            <div className="space-y-6">
              {customer ? (
                <Alert>
                  <Phone className="h-4 w-4" />
                  <AlertTitle>{t("pos.payment.confirmCustomer")}</AlertTitle>
                  <AlertDescription>
                    {t("pos.payment.paymentRequestTo", {
                      name: customer.name,
                      contact: customer.contact,
                    })}
                  </AlertDescription>
                </Alert>
              ) : (
                <div>
                  <Label htmlFor="mobileNumber">
                    {t("pos.payment.mobileNumber")}
                  </Label>
                  <Input
                    id="mobileNumber"
                    type="tel"
                    placeholder={t("pos.payment.mobileNumberPlaceholder")}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label>{t("pos.payment.selectProvider")}</Label>
                <RadioGroup
                  value={selectedMobileProvider}
                  onValueChange={setSelectedMobileProvider}
                  className="grid grid-cols-2 gap-4 mt-2"
                >
                  {mobileMoneyOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="font-normal">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
            <DialogFooter className="mt-8">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full min-h-[44px] touch-target"
                  disabled={isLoading}
                >
                  {t("pos.payment.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handlePlaceholderComplete}
                className="w-full min-h-[44px] touch-target px-4"
                disabled={!canCompleteMobileSale || isLoading}
                aria-busy={isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                )}
                {isLoading
                  ? t("pos.payment.processing")
                  : t("pos.payment.sendPaymentRequest", {
                      amount: canConvert
                        ? formatPayment(dueInPayment)
                        : formatStore(cartTotal),
                    })}
              </Button>
            </DialogFooter>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-[calc(100vw-2rem)] lg:max-w-4xl lg:min-w-[800px]">
          {renderContent()}
        </DialogContent>
      </Dialog>
      <DeviceSelector
        type="pos"
        open={showPosDeviceSelector}
        onClose={() => setShowPosDeviceSelector(false)}
        onSelect={handlePosDeviceSelect}
      />
    </>
  );
}
