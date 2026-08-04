"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Search,
  UserPlus,
  ChevronDown,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useCustomers } from "@/hooks/use-customers";
import type { Customer } from "@/types";
import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/use-store-currency";

const HEADER_BG = "#181F5E";

export interface CreditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  creditLimit?: number | null;
  onConfirmCredit: (payload: {
    customerId: string;
    paymentDate?: string;
    note?: string;
  }) => void;
  onAddCustomer?: () => void;
  isLoading?: boolean;
}

function getDefaultPaymentDate(): Date {
  return addDays(new Date(), 7);
}

export default function CreditSaleModal({
  isOpen,
  onClose,
  amount,
  creditLimit,
  onConfirmCredit,
  onAddCustomer,
  isLoading = false,
}: CreditSaleModalProps) {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [paymentDate, setPaymentDate] = useState<Date>(getDefaultPaymentDate());
  const [note, setNote] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const { customers, loading: customersLoading } = useCustomers({
    searchQuery: customerSearch,
    initialLimit: 1000,
  });

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact ?? "").toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const outstandingCredit = Number(selectedCustomer?.outstandingCredit ?? 0);
  const limit = creditLimit != null ? Number(creditLimit) : null;
  const totalAfterSale = outstandingCredit + amount;
  const isOverLimit = limit != null && limit >= 0 && totalAfterSale > limit;
  const canConfirm = selectedCustomer != null && !isOverLimit && !isLoading;

  const handleConfirm = () => {
    if (!canConfirm || !selectedCustomer) return;
    const payload: { customerId: string; paymentDate?: string; note?: string } =
      {
        customerId: selectedCustomer.id,
      };
    payload.paymentDate = format(paymentDate, "yyyy-MM-dd");
    if (note.trim()) payload.note = note.trim();
    onConfirmCredit(payload);
    handleClose();
  };

  const handleClose = () => {
    setCustomerSearch("");
    setSelectedCustomer(null);
    setPaymentDate(getDefaultPaymentDate());
    setNote("");
    setCustomerOpen(false);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(getDefaultPaymentDate());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!customerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setCustomerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [customerOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        title={t("pos.creditSale.title")}
        className="!flex !flex-col w-[380px] max-w-[95vw] !p-0 !gap-0 overflow-hidden border-0 shadow-xl bg-white rounded-xl [&>button]:hidden"
        style={{
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: 0,
        }}
      >
        <div
          className="w-full min-w-full shrink-0 px-5 py-4 flex flex-row items-center justify-between rounded-t-xl"
          style={{ backgroundColor: HEADER_BG }}
        >
          <span className="text-base font-semibold text-white">
            {t("pos.creditSale.title")}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            aria-label={t("pos.creditSale.closeAria")}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex flex-col p-5 gap-4 bg-white">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100">
            <span className="text-sm font-medium text-gray-700">
              {t("pos.creditSale.amountOnCredit")}
            </span>
            <span className="text-base font-semibold">
              {formatMoney(amount)}
            </span>
          </div>

          <div className="space-y-2" ref={customerDropdownRef}>
            <Label className="text-sm font-medium">
              {t("pos.creditSale.customer")}
            </Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCustomerOpen((prev) => !prev)}
                className="flex items-center justify-between w-full h-11 px-4 py-2 text-sm font-normal rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                aria-expanded={customerOpen}
                aria-haspopup="listbox"
              >
                {selectedCustomer ? (
                  <span className="truncate">{selectedCustomer.name}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("pos.creditSale.selectCustomer")}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    customerOpen && "rotate-180"
                  )}
                />
              </button>
              {customerOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("pos.creditSale.searchCustomer")}
                        className="pl-9 h-9"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <ScrollArea className="max-h-[220px]">
                    {customersLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {t("pos.creditSale.loadingCustomers")}
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {t("pos.creditSale.noCustomers")}
                      </div>
                    ) : (
                      <div className="p-1">
                        {filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent",
                              selectedCustomer?.id === c.id && "bg-accent"
                            )}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerOpen(false);
                            }}
                          >
                            <div className="font-medium truncate">{c.name}</div>
                            {c.contact ? (
                              <div className="text-xs text-muted-foreground truncate">
                                {c.contact}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  {onAddCustomer && (
                    <div className="p-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          onAddCustomer();
                          setCustomerOpen(false);
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        {t("pos.creditSale.addCustomer")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="text-sm text-muted-foreground">
                {t("pos.creditSale.outstandingCredit", {
                  amount: formatMoney(outstandingCredit),
                })}
                {limit != null && limit >= 0 && (
                  <span className="block mt-0.5">
                    {t("pos.creditSale.creditAvailable", {
                      amount: formatMoney(
                        Math.max(0, limit - outstandingCredit)
                      ),
                    })}
                  </span>
                )}
              </div>
            )}
            {selectedCustomer && isOverLimit && limit != null && (
              <p className="text-sm font-medium text-destructive">
                {t("pos.creditSale.limitExceeded", {
                  outstanding: formatMoney(outstandingCredit),
                  sale: formatMoney(amount),
                  limit: formatMoney(limit),
                })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="credit-payment-date"
              className="text-sm font-medium"
            >
              {t("pos.creditSale.paymentDueDate")}
            </Label>
            <div className="relative flex items-center">
              <CalendarIcon className="absolute left-3 h-4 w-4 shrink-0 text-muted-foreground pointer-events-none" />
              <Input
                id="credit-payment-date"
                type="date"
                value={format(paymentDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    const [y, m, d] = v.split("-").map(Number);
                    setPaymentDate(new Date(y, m - 1, d));
                  }
                }}
                className="h-11 pl-9 pr-4 text-sm"
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("pos.creditSale.note")}
            </Label>
            <Textarea
              placeholder={t("pos.creditSale.notePlaceholder")}
              className="min-h-[80px] resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full shrink-0 grid grid-cols-2 gap-4 px-5 py-6 rounded-b-xl bg-white border-t">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="!h-11 w-full rounded-md font-medium text-sm cursor-pointer border-gray-300 bg-white hover:bg-gray-50"
            onClick={handleClose}
          >
            {t("pos.creditSale.cancel")}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={!canConfirm}
            className="!h-11 w-full rounded-md font-medium text-sm cursor-pointer text-white border-0 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: HEADER_BG }}
            onClick={handleConfirm}
          >
            {t("pos.creditSale.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
