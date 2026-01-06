'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';

import type { Product, Transaction, TransactionItem, Customer } from '@/types';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, MinusCircle, XCircle, ShoppingCart, User, Percent } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function PosPage() {
  const [cart, setCart] = useState<Map<number, TransactionItem>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const { toast } = useToast();

  const products = useLiveQuery(() => db.products.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const existingItem = newCart.get(product.id!);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
      } else {
        newCart.set(product.id!, {
          productId: product.id!,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          totalPrice: product.price,
        });
      }
      return newCart;
    });
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const item = newCart.get(productId);
      if (item) {
        if (newQuantity <= 0) {
          newCart.delete(productId);
        } else {
          item.quantity = newQuantity;
          item.totalPrice = item.quantity * item.unitPrice;
        }
      }
      return newCart;
    });
  };

  const cartSubtotal = Array.from(cart.values()).reduce((acc, item) => acc + item.totalPrice, 0);
  const cartTotal = cartSubtotal; // For now, no discounts or taxes

  const handleCheckout = async () => {
    if (cart.size === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add products to the cart before checkout.",
        variant: 'destructive'
      });
      return;
    }
    
    const newTransaction: Transaction = {
      customerId: selectedCustomerId,
      date: new Date(),
      items: Array.from(cart.values()),
      total: cartTotal,
      paymentMethod: 'Cash', // Simplified
    };
    
    try {
      await db.transaction('rw', db.transactions, db.products, db.customers, async () => {
        // Add transaction
        const transactionId = await db.transactions.add(newTransaction);
        
        // Update stock
        for (const item of newTransaction.items) {
          await db.products.where({ id: item.productId }).modify(p => {
            p.stock -= item.quantity;
          });
        }
        
        // Update customer points
        if (selectedCustomerId) {
          await db.customers.where({ id: selectedCustomerId }).modify(c => {
            c.loyaltyPoints = (c.loyaltyPoints || 0) + Math.floor(cartTotal);
          });
        }
      });
      
      toast({
        title: "Checkout successful",
        description: `Transaction completed. Total: R${cartTotal.toFixed(2)}`,
      });
      setCart(new Map());
      setSelectedCustomerId(undefined);

    } catch (error) {
      console.error("Failed to checkout:", error);
      toast({
        title: "Checkout failed",
        description: "An error occurred during checkout. Please try again.",
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-full pr-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products?.map((product) => (
                  <Card key={product.id} className="overflow-hidden flex flex-col">
                    <div className="relative w-full aspect-square">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        data-ai-hint={product.imageHint}
                      />
                    </div>
                    <CardHeader className="p-4 flex-grow">
                      <CardTitle className="text-base font-medium">{product.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </CardHeader>
                    <CardFooter className="p-4 flex justify-between items-center">
                      <p className="font-semibold">R{product.price.toFixed(2)}</p>
                      <Button size="sm" onClick={() => addToCart(product)}>Add</Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Cart
            </CardTitle>
            <div className="flex items-center gap-2">
                <Select value={selectedCustomerId?.toString()} onValueChange={(val) => setSelectedCustomerId(Number(val))}>
                    <SelectTrigger className="w-[180px]">
                        <User className="h-4 w-4 mr-2"/>
                        <SelectValue placeholder="Select Customer" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">No Customer</SelectItem>
                        {customers?.map(c => <SelectItem key={c.id} value={c.id!.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-full pr-4">
              {cart.size === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(cart.values()).map((item) => (
                    <div key={item.productId} className="flex items-center gap-4">
                      <div className="flex-grow">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">R{item.unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <span>{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="w-20 text-right font-semibold">R{item.totalPrice.toFixed(2)}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateQuantity(item.productId, 0)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          {cart.size > 0 && (
            <CardFooter className="flex flex-col gap-4 !p-6 border-t">
              <div className="w-full flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>R{cartTotal.toFixed(2)}</span>
              </div>
              <Button size="lg" className="w-full" onClick={handleCheckout}>
                Checkout
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
