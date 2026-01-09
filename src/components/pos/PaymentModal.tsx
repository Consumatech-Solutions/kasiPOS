'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Transaction, TransactionItem } from '@/types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: 'Cash' | 'Card' | 'Mobile Money' | null;
  cartTotal: number;
  cartItems: TransactionItem[];
  onCompleteSale: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
}

export default function PaymentModal({ isOpen, onClose, method, cartTotal, cartItems, onCompleteSale }: PaymentModalProps) {

  useEffect(() => {
    // Reset local state when modal opens or method changes
    if (isOpen) {
      // Future state resets will go here
    }
  }, [isOpen, method]);


  if (!isOpen || !method) {
    return null;
  }
  
  const handlePlaceholderComplete = () => {
    onCompleteSale({
      items: cartItems,
      total: cartTotal,
      paymentMethod: method,
      // In a real scenario, you might get a transaction ID from a card reader
    });
  };

  const renderContent = () => {
    switch (method) {
      case 'Cash':
        return (
          <div>
            <DialogTitle>Cash Payment</DialogTitle>
            <DialogDescription>Cash payment UI will be built here.</DialogDescription>
            <div className="py-8 text-center text-muted-foreground">
                <p>Total: R{cartTotal.toFixed(2)}</p>
                <p>Placeholder for cash UI</p>
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {renderContent()}
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
