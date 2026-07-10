"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { TransactionDiscount } from "@/types";
import { cn } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { getCurrencySymbol } from "@/lib/format-money";

const DISCOUNT_REASONS = [
  "Loyal customer",
  "Bulk deal",
  "Damaged item",
  "Promo",
] as const;
const PERCENTAGE_QUICK = [5, 10, 15, 20];
const AMOUNT_QUICK = [5, 10, 20, 50];

const HEADER_BG = "#181F5E";
const PRIMARY_BG = "#1B1F5E";
const INPUT_BORDER = "#181F5E";
const DISCOUNT_RED = "#E24B4A";
const TEXT_MUTED = "#666";
const TEXT_DARK = "#444";
const BORDER_LIGHT = "#D0D0D8";
const SELECTED_CHIP_BG = "#E8E8F8";
const SELECTED_CHIP_BORDER = "#1B1F5E";

export interface ApplyDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartSubtotal: number;
  onApply: (discount: TransactionDiscount) => void;
}

export default function ApplyDiscountModal({
  isOpen,
  onClose,
  cartSubtotal,
  onApply,
}: ApplyDiscountModalProps) {
  const { formatMoney, currency } = useStoreCurrency();
  const currencySymbol = getCurrencySymbol(currency);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">(
    "percentage"
  );
  const [percentage, setPercentage] = useState<number>(10);
  const [amount, setAmount] = useState<number>(20);
  const [reason, setReason] = useState<string>("Loyal customer");

  const maxAmount = Math.max(0, cartSubtotal);
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const clampedAmount = Math.min(maxAmount, Math.max(0, amount));

  const discountValue =
    discountType === "percentage" ? clampedPercentage : clampedAmount;
  const discountAmountInCurrency =
    discountType === "percentage"
      ? Math.round(((cartSubtotal * discountValue) / 100) * 100) / 100
      : discountValue;
  const newTotal =
    Math.round((cartSubtotal - discountAmountInCurrency) * 100) / 100;
  const equivalentPercent =
    cartSubtotal > 0
      ? Math.round((discountAmountInCurrency / cartSubtotal) * 1000) / 10
      : 0;

  const canApply = useMemo(() => {
    if (discountType === "percentage") {
      return clampedPercentage >= 0 && clampedPercentage <= 100;
    }
    return clampedAmount >= 0 && clampedAmount <= maxAmount;
  }, [discountType, clampedPercentage, clampedAmount, maxAmount]);

  const handleApply = () => {
    if (!canApply) return;
    onApply({
      discountType: discountType === "percentage" ? "percentage" : "amount",
      discountAmount:
        discountType === "percentage" ? clampedPercentage : clampedAmount,
      discountReason: reason.trim(),
    });
    handleClose();
  };

  const handleClose = () => {
    setDiscountType("percentage");
    setPercentage(10);
    setAmount(20);
    setReason("Loyal customer");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        title="Apply discount"
        className="!flex !flex-col w-[380px] max-w-[95vw] !p-0 !gap-0 overflow-hidden border-0 shadow-xl bg-white rounded-xl [&>button]:hidden"
        style={{
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: 0,
        }}
      >
        <div
          className="w-full min-w-full shrink-0 px-5 py-4 flex flex-row items-center justify-between rounded-t-xl first:rounded-t-xl"
          style={{ backgroundColor: HEADER_BG }}
        >
          <span className="text-base font-semibold text-white">
            Apply discount
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="w-full bg-white pt-5 px-5 pb-2 sm:pt-6 sm:px-6 sm:pb-3 flex flex-col">
          <div
            className="flex rounded-lg mb-4 border border-gray-200 bg-white"
            style={{ padding: "4px", borderRadius: "8px" }}
          >
            <button
              type="button"
              onClick={() => setDiscountType("percentage")}
              className={cn(
                "flex-1 rounded-md py-3 text-xs font-medium transition-colors cursor-pointer",
                discountType === "percentage" ? "text-white" : ""
              )}
              style={{
                backgroundColor:
                  discountType === "percentage" ? PRIMARY_BG : "transparent",
                color: discountType === "percentage" ? "#fff" : TEXT_MUTED,
                borderRadius: "6px",
                fontWeight: discountType === "percentage" ? 500 : 400,
              }}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setDiscountType("amount")}
              className={cn(
                "flex-1 rounded-md py-3 text-xs font-medium transition-colors cursor-pointer",
                discountType === "amount" ? "text-white" : ""
              )}
              style={{
                backgroundColor:
                  discountType === "amount" ? PRIMARY_BG : "transparent",
                color: discountType === "amount" ? "#fff" : TEXT_MUTED,
                borderRadius: "6px",
                fontWeight: discountType === "amount" ? 500 : 400,
              }}
            >
              Amount ({currencySymbol})
            </button>
          </div>

          {discountType === "percentage" ? (
            <>
              <div className="mb-4">
                <Label
                  className="block mb-2 text-xs"
                  style={{ color: TEXT_MUTED }}
                >
                  Discount percentage
                </Label>
                <div
                  className="flex rounded-lg overflow-hidden mb-4"
                  style={{
                    border: "1.5px solid " + INPUT_BORDER,
                    borderRadius: "8px",
                  }}
                >
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={percentage}
                    onChange={(e) =>
                      setPercentage(parseFloat(e.target.value) || 0)
                    }
                    className="flex-1 border-0 rounded-none focus-visible:ring-0 bg-transparent py-2.5 px-3 text-sm font-medium outline-none w-full"
                    style={{ color: INPUT_BORDER }}
                  />
                  <span
                    className="flex items-center px-3 text-sm font-medium bg-white border-l border-gray-200"
                    style={{ color: TEXT_MUTED }}
                  >
                    %
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERCENTAGE_QUICK.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-full py-1.5 text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        padding: "6px 12px",
                        backgroundColor:
                          percentage === p ? SELECTED_CHIP_BG : "#fff",
                        border:
                          percentage === p
                            ? `1px solid ${SELECTED_CHIP_BORDER}`
                            : "1px solid #e5e5e5",
                        color:
                          percentage === p ? SELECTED_CHIP_BORDER : TEXT_DARK,
                        borderRadius: "20px",
                        fontWeight: percentage === p ? 500 : 400,
                      }}
                      onClick={() => setPercentage(p)}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <Label
                  className="block mb-2 text-xs"
                  style={{ color: TEXT_MUTED }}
                >
                  Discount amount
                </Label>
                <div
                  className="flex rounded-lg overflow-hidden mb-2"
                  style={{
                    border: "1.5px solid " + INPUT_BORDER,
                    borderRadius: "8px",
                  }}
                >
                  <span
                    className="flex items-center px-3 text-sm font-medium bg-white border-r border-gray-200"
                    style={{ color: TEXT_MUTED }}
                  >
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={maxAmount}
                    step={0.01}
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 border-0 rounded-none focus-visible:ring-0 bg-transparent py-2.5 px-3 text-sm font-medium outline-none w-full"
                    style={{ color: INPUT_BORDER }}
                  />
                </div>
                <p className="text-xs mb-4" style={{ color: TEXT_MUTED }}>
                  Maximum: {formatMoney(maxAmount)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {AMOUNT_QUICK.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="rounded-full py-1.5 text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        padding: "6px 12px",
                        backgroundColor:
                          amount === a ? SELECTED_CHIP_BG : "#fff",
                        border:
                          amount === a
                            ? `1px solid ${SELECTED_CHIP_BORDER}`
                            : "1px solid #e5e5e5",
                        color: amount === a ? SELECTED_CHIP_BORDER : TEXT_DARK,
                        borderRadius: "20px",
                        fontWeight: amount === a ? 500 : 400,
                      }}
                      onClick={() => setAmount(a)}
                    >
                      {formatMoney(a)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mb-4">
            <Label className="block mb-2 text-xs" style={{ color: TEXT_MUTED }}>
              Reason for discount{" "}
              <span style={{ color: "#aaa" }}>(optional)</span>
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DISCOUNT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="rounded-full py-1.5 text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    padding: "6px 12px",
                    backgroundColor: reason === r ? SELECTED_CHIP_BG : "#fff",
                    border:
                      reason === r
                        ? `1px solid ${SELECTED_CHIP_BORDER}`
                        : "1px solid #e5e5e5",
                    color: reason === r ? SELECTED_CHIP_BORDER : TEXT_DARK,
                    borderRadius: "20px",
                    fontWeight: reason === r ? 500 : 400,
                  }}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Or type a reason..."
              className="w-full box-border rounded-lg py-2.5 px-3 text-xs outline-none border-0 bg-transparent"
              style={{ border: "1.5px solid " + BORDER_LIGHT }}
            />
          </div>

          <div
            className="rounded-lg bg-white border border-gray-200"
            style={{ padding: "14px 16px", marginBottom: "6px" }}
          >
            <div className="flex justify-between mb-2 text-xs">
              <span style={{ color: "#888" }}>Cart total</span>
              <span style={{ color: TEXT_DARK }}>
                {formatMoney(cartSubtotal)}
              </span>
            </div>
            <div className="flex justify-between mb-2 text-xs">
              <span style={{ color: "#888" }}>
                Discount (
                {discountType === "percentage"
                  ? `${clampedPercentage}%`
                  : formatMoney(clampedAmount)}
                )
              </span>
              <span className="font-medium" style={{ color: DISCOUNT_RED }}>
                - {formatMoney(discountAmountInCurrency)}
              </span>
            </div>
            {discountType === "amount" && equivalentPercent > 0 && (
              <p className="text-[11px] mb-2" style={{ color: TEXT_MUTED }}>
                Equivalent to {equivalentPercent}%
              </p>
            )}
            <div
              className="flex justify-between pt-2"
              style={{
                borderTop: "1px dashed " + BORDER_LIGHT,
                paddingTop: "8px",
                color: PRIMARY_BG,
              }}
            >
              <span className="font-medium text-sm">New total</span>
              <span className="font-semibold text-base">
                {formatMoney(newTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 grid grid-cols-2 gap-4 px-5 py-4 rounded-b-xl bg-white">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleClose}
            className="!h-11 w-full rounded-md font-medium text-sm cursor-pointer border-gray-300 bg-white hover:bg-gray-50"
            style={{ color: TEXT_DARK }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleApply}
            disabled={!canApply}
            className="!h-11 w-full rounded-md font-medium text-sm cursor-pointer text-white border-0 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: PRIMARY_BG }}
          >
            Apply discount
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
