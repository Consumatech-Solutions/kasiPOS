'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ticket, XCircle, CheckCircle } from 'lucide-react';
import type { Voucher } from '@/types';
import { db } from '@/lib/db';
import { Separator } from '@/components/ui/separator';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoucher: (code: string, amount: number) => void;
  cartTotal: number;
}

export default function VoucherModal({ isOpen, onClose, onApplyVoucher, cartTotal }: VoucherModalProps) {
  const [voucherCode, setVoucherCode] = useState('');
  const [foundVoucher, setFoundVoucher] = useState<Voucher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountToApply, setAmountToApply] = useState(0);

  const handleFindVoucher = async () => {
    setError(null);
    setFoundVoucher(null);

    const voucher = await db.vouchers
      .where('code')
      .equalsIgnoreCase(voucherCode)
      .first();

    if (!voucher || !voucher.isActive) {
      setError('Voucher code is invalid or has expired.');
      return;
    }
    
    if (cartTotal < voucher.minPurchase) {
      setError(`A minimum purchase of R${voucher.minPurchase.toFixed(2)} is required for this voucher.`);
      return;
    }

    setFoundVoucher(voucher);
    const potentialValue = voucher.type === 'percentage' 
      ? (cartTotal * voucher.value) / 100
      : voucher.value;
    setAmountToApply(Math.min(potentialValue, cartTotal));
  };
  
  const handleApply = () => {
    if (!foundVoucher) return;
    onApplyVoucher(foundVoucher.code, amountToApply);
    handleClose();
  };

  const handleClose = () => {
    setVoucherCode('');
    setFoundVoucher(null);
    setError(null);
    setAmountToApply(0);
    onClose();
  };

  const getVoucherDescription = (voucher: Voucher) => {
    if (voucher.type === 'percentage') {
      return `${voucher.value}% off your purchase.`;
    }
    return `R${voucher.value.toFixed(2)} off your purchase.`;
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ticket /> Redeem Voucher</DialogTitle>
          <DialogDescription>Enter a voucher code to apply a discount to the current sale.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input 
              id="voucherCode"
              placeholder="Enter code (e.g., SAVE10)"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
            />
            <Button onClick={handleFindVoucher}>Find Voucher</Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {foundVoucher && (
            <div className="space-y-4">
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Voucher Found!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Code <span className="font-mono font-bold">{foundVoucher.code}</span> gives you {getVoucherDescription(foundVoucher)}
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
                    value={amountToApply}
                    onChange={(e) => setAmountToApply(Number(e.target.value))}
                    className="text-xl h-12 font-bold"
                  />
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    You can apply up to R{foundVoucher.type === 'fixed' ? foundVoucher.value.toFixed(2) : ((cartTotal * foundVoucher.value) / 100).toFixed(2)}.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
          <Button onClick={handleApply} disabled={!foundVoucher || amountToApply <= 0 || amountToApply > cartTotal}>Apply Discount</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
