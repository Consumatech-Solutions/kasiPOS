'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Transaction, TransactionItem, Customer } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Phone, Loader2 } from 'lucide-react';


interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: 'Cash' | 'Card' | 'Mobile Money' | null;
  cartTotal: number;
  cartItems: TransactionItem[];
  onCompleteSale: (transaction: Omit<Transaction, 'id' | 'date' | 'storeId'>) => void;
  customer: Customer | null | undefined;
  isLoading?: boolean;
}

const mobileMoneyOptions = ['MTN MoMo', 'Vodacom VodaPay', 'InstantMoney (Standard Bank)', 'eWallet (FNB)', 'CashSend (ABSA)', 'Imali (Nedbank)'];

export default function PaymentModal({ isOpen, onClose, method, cartTotal, cartItems, onCompleteSale, customer, isLoading = false }: PaymentModalProps) {
  const [tendered, setTendered] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedMobileProvider, setSelectedMobileProvider] = useState('');

  const tenderedAmount = parseFloat(tendered) || 0;
  const changeDue = tenderedAmount - cartTotal;
  const canCompleteCashSale = tenderedAmount >= cartTotal;
  const canCompleteMobileSale = (customer?.contact || mobileNumber.length > 10) && selectedMobileProvider;


  useEffect(() => {
    // Reset local state when modal opens or method changes
    if (isOpen) {
      setTendered('');
      setMobileNumber(customer?.contact || '');
      setSelectedMobileProvider('');
    }
  }, [isOpen, method, customer]);
  
  const handleKeyPress = (key: string) => {
    if (key === '.' && tendered.includes('.')) return;
    setTendered(tendered + key);
  };
  
  const handleClear = () => setTendered('');
  const handleBackspace = () => setTendered(tendered.slice(0, -1));

  const handleCompleteCashSale = () => {
    if (canCompleteCashSale) {
      onCompleteSale({
        items: cartItems,
        total: cartTotal,
        paymentMethod: 'Cash',
      });
    }
  };

  const handlePlaceholderComplete = () => {
    if (!method) return;
     if (method === 'Mobile Money' && !canCompleteMobileSale) return;
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
                  <Button variant="secondary" className="w-full h-14 touch-target" onClick={handleClear} disabled={isLoading}>Clear</Button>
                  <Button className="w-full h-14 touch-target" onClick={handleCompleteCashSale} disabled={!canCompleteCashSale || isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Processing...' : 'Complete Sale'}
                  </Button>
              </DialogFooter>
            </div>
          </div>
        );
      case 'Card':
        return (
          <div>
            <DialogHeader className="text-center mb-6">
                <DialogTitle className="text-2xl">Card Payment</DialogTitle>
                <DialogDescription>Total amount to be charged to the card.</DialogDescription>
            </DialogHeader>
             <div className="py-8 text-center text-muted-foreground bg-slate-50 rounded-lg">
                <p className="text-4xl font-bold text-foreground">R {cartTotal.toFixed(2)}</p>
                <p className="mt-2">Waiting for card machine interaction...</p>
            </div>
            <DialogFooter className="mt-6">
                <DialogClose asChild><Button variant="secondary" className="w-full min-h-[44px] touch-target" disabled={isLoading}>Cancel</Button></DialogClose>
                <Button onClick={handlePlaceholderComplete} className="w-full min-h-[44px] touch-target" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Processing...' : 'Simulate Successful Payment'}
                </Button>
            </DialogFooter>
          </div>
        );
      case 'Mobile Money':
        return (
            <div>
              <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl">Mobile Money</DialogTitle>
                  <DialogDescription>Select a provider and confirm the mobile number to send the USSD push to.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {customer ? (
                  <Alert>
                    <Phone className="h-4 w-4" />
                    <AlertTitle>Confirm Customer</AlertTitle>
                    <AlertDescription>
                      The payment request will be sent to <strong>{customer.name}</strong> at <strong>{customer.contact}</strong>.
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
                    {mobileMoneyOptions.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="font-normal">{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter className="mt-8">
                  <DialogClose asChild><Button variant="secondary" className="w-full min-h-[44px] touch-target" disabled={isLoading}>Cancel</Button></DialogClose>
                  <Button onClick={handlePlaceholderComplete} className="w-full min-h-[44px] touch-target" disabled={!canCompleteMobileSale || isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Processing...' : `Send Payment Request for R${cartTotal.toFixed(2)}`}
                  </Button>
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
