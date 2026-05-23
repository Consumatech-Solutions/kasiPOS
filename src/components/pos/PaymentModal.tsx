"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Transaction, TransactionItem, Customer } from "@/types";
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
import { getStoredDevice, connectPos, getDevices } from "@/lib/device-service";
import { useToast } from "@/hooks/use-toast";
import {
  appendTenderedKey,
  sanitizeTenderedInput,
} from "@/lib/payment-tendered-input";

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
  const [tendered, setTendered] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedMobileProvider, setSelectedMobileProvider] = useState("");
  const [showPosDeviceSelector, setShowPosDeviceSelector] = useState(false);
  const [posConnected, setPosConnected] = useState(false);
  const [isConnectingPos, setIsConnectingPos] = useState(false);
  const { toast } = useToast();

  const tenderedAmount = parseFloat(tendered) || 0;
  const change = Math.max(0, tenderedAmount - cartTotal);
  const canCompleteCashSale = tenderedAmount >= cartTotal;
  const isInsufficient = tenderedAmount > 0 && tenderedAmount < cartTotal;
  const canCompleteMobileSale =
    (customer?.contact || mobileNumber.length > 10) && selectedMobileProvider;

  useEffect(() => {
    if (isOpen) {
      setTendered("");
      setMobileNumber(customer?.contact || "");
      setSelectedMobileProvider("");
      setPosConnected(false);

      if (method === "Card") {
        const deviceId = getStoredDevice("pos");
        if (deviceId) {
          handleConnectPos(deviceId);
        }
      }
    }
  }, [isOpen, method, customer]);

  const handleConnectPos = async (deviceId: string) => {
    setIsConnectingPos(true);
    try {
      await connectPos(deviceId);
      setPosConnected(true);
      toast({
        title: "POS device connected",
        description: "Card reader is ready to process payments.",
      });
    } catch (error: any) {
      setPosConnected(false);
      toast({
        variant: "destructive",
        title: "POS connection failed",
        description: error.message || "Failed to connect to POS device.",
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
    if (isLoading || !canCompleteCashSale) return;
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: "Cash",
    });
  }, [isLoading, canCompleteCashSale, onCompleteSale, cartItems, cartTotal]);

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
    if (isLoading || !method) return;
    if (method === "Mobile Money" && !canCompleteMobileSale) return;
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: method,
    });
  };

  const renderContent = () => {
    switch (method) {
      case "Cash":
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

        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl">Cash Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Due:</span>
                  <span className="font-bold">R {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-bold">
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
              </div>
              <Separator className="my-6" />
              <div className="space-y-4 text-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tendered:</span>
                  <span className="font-bold text-primary">
                    R {tenderedAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Change:</span>
                  <span className="font-bold text-green-600">
                    R {Math.max(0, tenderedAmount - cartTotal).toFixed(2)}
                  </span>
                </div>
                {tenderedAmount === 0 && (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                    No amount entered. Enter the amount received from the
                    customer.
                  </p>
                )}
                {isInsufficient && (
                  <p className="text-sm text-destructive">
                    Amount insufficient. Add R{" "}
                    {(cartTotal - tenderedAmount).toFixed(2)} more to complete.
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-4">
                <label
                  htmlFor="tendered"
                  className="text-sm text-muted-foreground"
                >
                  Amount Tendered
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                    R
                  </span>
                  <Input
                    id="tendered"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
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
                    disabled={isLoading}
                    aria-label="Amount tendered"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {quickBills.map((bill) => (
                  <Button
                    key={bill}
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={() => setTendered(bill.toString())}
                    disabled={isLoading}
                  >
                    R{bill}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => setTendered(cartTotal.toFixed(2))}
                  disabled={isLoading}
                >
                  EXACT
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
                    disabled={isLoading}
                  >
                    {key}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-xl"
                  onClick={handleBackspace}
                  disabled={isLoading}
                >
                  &larr;
                </Button>
              </div>
              <DialogFooter className="mt-4 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-14 touch-target"
                  onClick={handleClear}
                  disabled={isLoading}
                >
                  Clear
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
                  {isLoading ? "Processing..." : "Complete Sale"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        );
      case "Card":
        const posDeviceId = getStoredDevice("pos");
        return (
          <div>
            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-2xl">Card Payment</DialogTitle>
              <DialogDescription>
                Total amount to be charged to the card.
              </DialogDescription>
            </DialogHeader>

            <div className="mb-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-sm">POS Device</p>
                    <p className="text-xs text-muted-foreground">
                      {posDeviceId ? "Device selected" : "No device selected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnectingPos ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Connecting...
                      </span>
                    </>
                  ) : posConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        Connected
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Not Connected
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
                    {posDeviceId ? "Change" : "Select"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="py-8 text-center text-muted-foreground bg-slate-50 rounded-lg">
              <p className="text-4xl font-bold text-foreground">
                R {cartTotal.toFixed(2)}
              </p>
              <p className="mt-2">
                {posConnected
                  ? "Waiting for card machine interaction..."
                  : posDeviceId
                    ? "Connect to POS device to process payment"
                    : "Select a POS device to process payment"}
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
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handlePlaceholderComplete}
                className="w-full min-h-[44px] touch-target"
                disabled={isLoading || !posConnected}
                aria-busy={isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                )}
                {isLoading
                  ? "Processing..."
                  : posConnected
                    ? "Process Payment"
                    : "Connect POS Device First"}
              </Button>
            </DialogFooter>
          </div>
        );
      case "Mobile Money":
        return (
          <div>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">Mobile Money</DialogTitle>
              <DialogDescription>
                Select a provider and confirm the mobile number to send the USSD
                push to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {customer ? (
                <Alert>
                  <Phone className="h-4 w-4" />
                  <AlertTitle>Confirm Customer</AlertTitle>
                  <AlertDescription>
                    The payment request will be sent to{" "}
                    <strong>{customer.name}</strong> at{" "}
                    <strong>{customer.contact}</strong>.
                  </AlertDescription>
                </Alert>
              ) : (
                <div>
                  <Label htmlFor="mobileNumber">Mobile Number</Label>
                  <Input
                    id="mobileNumber"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label>Select Provider</Label>
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
                  Cancel
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
                  ? "Processing..."
                  : `Send Payment Request for R${cartTotal.toFixed(2)}`}
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
        <DialogContent className="max-w-4xl md:min-w-[800px] min-w-[90vw]">
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
