'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Transaction, TransactionItem } from '@/types';
import { Separator } from '@/components/ui/separator';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: 'Cash' | 'Card' | 'Mobile Money' | null;
  cartTotal: number;
  cartItems: TransactionItem[];
  onCompleteSale: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
}

export default function PaymentModal({ isOpen, onClose, method, cartTotal, cartItems, onCompleteSale }: PaymentModalProps) {
  const [tendered, setTendered] = useState('');

  const tenderedAmount = parseFloat(tendered) || 0;
  const changeDue = tenderedAmount - cartTotal;
  const canCompleteSale = tenderedAmount >= cartTotal;

  useEffect(() => {
    // Reset local state when modal opens or method changes
    if (isOpen) {
      setTendered('');
    }
  }, [isOpen, method]);
  
  const handleKeyPress = (key: string) => {
    if (key === '.' && tendered.includes('.')) return;
    setTendered(tendered + key);
  };
  
  const handleClear = () => setTendered('');
  const handleBackspace = () => setTendered(tendered.slice(0, -1));

  const handleCompleteCashSale = () => {
    if (canCompleteSale) {
      onCompleteSale({
        items: cartItems,
        total: cartTotal,
        paymentMethod: 'Cash',
      });
    }
  };

  const handlePlaceholderComplete = () => {
    if (!method) return;
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: method,
    });
  };

  const renderContent = () => {
    switch (method) {
      case 'Cash':
        const quickBills = [50, 100, 200];
        const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

        return (
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column: Totals */}
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
                  <span className="font-bold">{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
              </div>
              <Separator className="my-6" />
              <div className="space-y-4 text-2xl">
                 <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tendered:</span>
                  <span className="font-bold text-primary">R {tenderedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Change:</span>
                  <span className={`font-bold ${changeDue < 0 ? 'text-destructive' : 'text-green-600'}`}>R {changeDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Input & Keypad */}
            <div>
              <div className="mb-4">
                <label htmlFor="tendered" className="text-sm text-muted-foreground">Amount Tendered</label>
                <Input 
                  id="tendered" 
                  value={tendered ? `R ${tendered}`: ''} 
                  placeholder="R 0.00" 
                  className="text-2xl h-14 text-right font-mono" 
                  readOnly 
                />
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {quickBills.map(bill => (
                    <Button key={bill} variant="outline" className="h-12" onClick={() => setTendered(bill.toString())}>R{bill}</Button>
                ))}
                 <Button variant="outline" className="h-12" onClick={() => setTendered(cartTotal.toFixed(2))}>EXACT</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.map(key => (
                    <Button key={key} variant="outline" className="h-12 text-xl" onClick={() => handleKeyPress(key)}>{key}</Button>
                ))}
                <Button variant="outline" className="h-12 text-xl" onClick={handleBackspace}>&larr;</Button>
              </div>
              <DialogFooter className="mt-4 gap-2">
                  <Button variant="secondary" className="w-full h-14" onClick={handleClear}>Clear</Button>
                  <Button className="w-full h-14" onClick={handleCompleteCashSale} disabled={!canCompleteSale}>Complete Sale</Button>
              </DialogFooter>
            </div>
          </div>
        );
      case 'Card':
        return (
          <div>
            <DialogTitle>Card Payment</DialogTitle>
             <div className="py-8 text-center text-muted-foreground">
                <p>Total: R{cartTotal.toFixed(2)}</p>
                <p>Waiting for card machine interaction...</p>
            </div>
            <DialogFooter>
                <Button onClick={handlePlaceholderComplete} className="w-full">Simulate Successful Payment</Button>
            </DialogFooter>
          </div>
        );
      case 'Mobile Money':
        return (
          <div>
            <DialogTitle>Mobile Money</DialogTitle>
            <div className="py-8 text-center text-muted-foreground">
                <p>Total: R{cartTotal.toFixed(2)}</p>
                <p>Awaiting USSD push to customer's phone...</p>
            </div>
             <DialogFooter>
                <Button onClick={handlePlaceholderComplete} className="w-full">Simulate Successful Payment</Button>
            </DialogFooter>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
