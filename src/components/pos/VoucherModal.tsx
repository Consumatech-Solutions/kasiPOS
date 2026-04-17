"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ticket, XCircle, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useVouchers } from "@/hooks/use-vouchers";

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoucher: (code: string, amount: number) => void;
  cartTotal: number;
  customerId?: string;
}

export default function VoucherModal({
  isOpen,
  onClose,
  onApplyVoucher,
  cartTotal,
  customerId,
}: VoucherModalProps) {
  const [voucherCode, setVoucherCode] = useState("");
  const [validatedVoucher, setValidatedVoucher] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountToApply, setAmountToApply] = useState(0);
  const [validating, setValidating] = useState(false);
  const { validateVoucher } = useVouchers({ autoLoad: false });

  const handleFindVoucher = async () => {
    if (!voucherCode.trim()) {
      setError("Please enter a voucher code.");
      return;
    }

    setError(null);
    setValidatedVoucher(null);
    setValidating(true);

    try {
      const result = await validateVoucher({
        code: voucherCode,
        cartTotal,
        customerId,
      });

      if (!result.valid) {
        setError(result.message || "Voucher code is invalid.");
        return;
      }

      setValidatedVoucher(result.voucher);
      setAmountToApply(result.discountAmount || 0);
    } catch (err: any) {
      setError(err.message || "Failed to validate voucher.");
    } finally {
      setValidating(false);
    }
  };

  const handleApply = () => {
    if (!validatedVoucher || amountToApply <= 0) return;
    onApplyVoucher(validatedVoucher.code, amountToApply);
    handleClose();
  };

  const handleClose = () => {
    setVoucherCode("");
    setValidatedVoucher(null);
    setError(null);
    setAmountToApply(0);
    onClose();
  };

  const getVoucherDescription = (voucher: any) => {
    if (voucher.type === "percentage") {
      return `${Number(voucher.value)}% off your purchase.`;
    }
    return `R${Number(voucher.value).toFixed(2)} off your purchase.`;
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket /> Redeem Voucher
          </DialogTitle>
          <DialogDescription>
            Enter a voucher code to apply a discount to the current sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              id="voucherCode"
              placeholder="Enter code (e.g., SAVE10)"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
            />
            <Button onClick={handleFindVoucher} disabled={validating}>
              {validating ? "Validating..." : "Find Voucher"}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validating && (
            <div className="text-center py-4 text-muted-foreground">
              Validating voucher...
            </div>
          )}

          {validatedVoucher && (
            <div className="space-y-4">
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">
                  Voucher Found!
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  Code{" "}
                  <span className="font-mono font-bold">
                    {validatedVoucher.code}
                  </span>{" "}
                  gives you {getVoucherDescription(validatedVoucher)}
                </AlertDescription>
              </Alert>

              <Separator />

              <div>
                <Label htmlFor="amountToApply">Amount to Apply</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-bold">R</span>
                  <Input
                    id="amountToApply"
                    type="number"
                    step="0.01"
                    min="0"
                    max={cartTotal}
                    value={amountToApply}
                    onChange={(e) =>
                      setAmountToApply(
                        Math.min(Number(e.target.value) || 0, cartTotal),
                      )
                    }
                    className="text-xl h-12 font-bold"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum discount: R{amountToApply.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleApply}
            disabled={
              !validatedVoucher ||
              amountToApply <= 0 ||
              amountToApply > cartTotal
            }
          >
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
