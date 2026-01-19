'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import type { PurchaseOrderItem } from '@/types';
import { db } from '@/lib/db';
import { useSettings } from '@/components/settings-provider';

const DELIVERY_FEE = 150.00;

export default function BuyStockCartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { currentStore } = settings;
  
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'collection'>('collection');
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [confirmedOrderCode, setConfirmedOrderCode] = useState('');

  useEffect(() => {
    const storedCart = localStorage.getItem('purchaseOrderCart');
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);

  const updateCart = (newCart: PurchaseOrderItem[]) => {
    setCart(newCart);
    localStorage.setItem('purchaseOrderCart', JSON.stringify(newCart));
  };
  
  const handleQuantityChange = (productId: number, newQuantity: number) => {
    const newCart = cart.map(item => {
      if (item.productId === productId) {
        if (newQuantity <= 0) return null; // Mark for removal
        const updatedItem = { ...item, quantity: newQuantity };
        updatedItem.totalPrice = updatedItem.quantity * updatedItem.groupPrice;
        return updatedItem;
      }
      return item;
    }).filter(Boolean) as PurchaseOrderItem[];
    updateCart(newCart);
  };
  
  const handleRemoveItem = (productId: number) => {
    const newCart = cart.filter(item => item.productId !== productId);
    updateCart(newCart);
  };
  
  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.totalPrice, 0), [cart]);
  const total = useMemo(() => subtotal + (deliveryMethod === 'delivery' ? DELIVERY_FEE : 0), [subtotal, deliveryMethod]);
  
  const generateOrderCode = () => {
    const prefix = 'PO-';
    const randomNum = Math.floor(Math.random() * 90000) + 10000;
    return prefix + randomNum;
  };
  
  const handleConfirmOrder = async () => {
    if (!currentStore) {
      toast({ variant: 'destructive', title: 'Error', description: 'No store context found.' });
      return;
    }
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart is empty', description: 'Please add items to your cart before confirming.' });
      return;
    }
    
    const orderCode = generateOrderCode();
    const newOrder = {
      orderCode,
      date: new Date(),
      items: cart,
      subtotal: subtotal,
      deliveryFee: deliveryMethod === 'delivery' ? DELIVERY_FEE : 0,
      total: total,
      deliveryMethod,
      status: 'pending' as 'pending',
      storeId: currentStore.id!,
    };
    
    try {
      await db.purchaseOrders.add(newOrder);
      setConfirmedOrderCode(orderCode);
      setIsOrderConfirmed(true);
      updateCart([]); // Clear the cart
    } catch (error) {
      console.error('Failed to save purchase order:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save the purchase order.' });
    }
  };
  
  const closeConfirmationDialog = () => {
    setIsOrderConfirmed(false);
    router.push('/buy-stock/history');
  }

  return (
    <>
      <div className="p-4">
        <Card>
          <CardHeader>
              <div className="flex items-center gap-4">
                  <Button asChild variant="outline" size="icon">
                      <Link href="/buy-stock">
                          <ArrowLeft className="h-4 w-4" />
                      </Link>
                  </Button>
                  <div>
                      <CardTitle>Supplier Cart</CardTitle>
                      <CardDescription>Review and place your purchase order.</CardDescription>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <p>Your purchase order cart is empty.</p>
                     <Button asChild variant="link">
                        <Link href="/buy-stock">Return to Catalogue</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Group Price</TableHead>
                                    <TableHead className="w-[120px]">Quantity</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                        <TableCell>R{item.groupPrice.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10) || 0)}
                                                    className="h-8 w-14 text-center"
                                                />
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">R{item.totalPrice.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.productId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Delivery Method</Label>
                                    <RadioGroup value={deliveryMethod} onValueChange={(value) => setDeliveryMethod(value as 'delivery' | 'collection')} className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <RadioGroupItem value="collection" id="collection" className="peer sr-only" />
                                            <Label htmlFor="collection" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                Collection
                                                <span className="text-xs font-normal">FREE</span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                                            <Label htmlFor="delivery" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                Delivery
                                                <span className="text-xs font-normal">R{DELIVERY_FEE.toFixed(2)}</span>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>R{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Delivery Fee</span>
                                        <span>R{(deliveryMethod === 'delivery' ? DELIVERY_FEE : 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                                        <span>Total</span>
                                        <span>R{total.toFixed(2)}</span>
                                    </div>
                                </div>
                                <Button className="w-full" size="lg" onClick={handleConfirmOrder}>Confirm Order</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

       <AlertDialog open={isOrderConfirmed} onOpenChange={setIsOrderConfirmed}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Order Confirmed!</AlertDialogTitle>
                <AlertDialogDescription>
                    Your purchase order has been placed successfully. Please use the code below for payment and collection/delivery tracking.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">Your Order Code</p>
                    <p className="text-4xl font-bold tracking-widest font-mono p-4 bg-muted rounded-lg mt-2">{confirmedOrderCode}</p>
                </div>
                <AlertDialogFooter>
                <AlertDialogAction onClick={closeConfirmationDialog}>View Order History</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
