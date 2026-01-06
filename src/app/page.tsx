'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';

import type { Product, Transaction, TransactionItem, Customer } from '@/types';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, User, Ticket, Search, QrCode, CreditCard, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const quickAccessCategories = ['Bread', 'Airtime', 'Dairy', 'Cigs', 'Veg', 'Cool Drinks', 'Snacks', 'Groceries', 'Beverages', 'Toiletries'];

export default function PosPage() {
  const [cart, setCart] = useState<Map<number, TransactionItem>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { toast } = useToast();

  const products = useLiveQuery(() => 
    activeCategory 
      ? db.products.where('category').equalsIgnoreCase(activeCategory).toArray()
      : db.products.toArray()
  , [activeCategory]);
  
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
          imageUrl: product.imageUrl,
          stock: product.stock,
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

  const clearCart = () => {
    setCart(new Map());
  }

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const vat = cartSubtotal * 0.15;
  const cartTotal = cartSubtotal; // Simplified for now

  const handleCheckout = async (method: 'Cash' | 'Card') => {
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
      items: cartItems,
      total: cartTotal,
      paymentMethod: method,
    };
    
    try {
      await db.transaction('rw', db.transactions, db.products, db.customers, async () => {
        const transactionId = await db.transactions.add(newTransaction);
        
        for (const item of newTransaction.items) {
          await db.products.where({ id: item.productId }).modify(p => {
            p.stock -= item.quantity;
          });
        }
        
        if (selectedCustomerId) {
          await db.customers.where({ id: selectedCustomerId }).modify(c => {
            c.loyaltyPoints = (c.loyaltyPoints || 0) + Math.floor(cartTotal);
          });
        }
      });
      
      toast({
        title: "Checkout successful",
        description: `Transaction completed with ${method}. Total: R${cartTotal.toFixed(2)}`,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-6 h-[calc(100vh-80px)]">
      {/* Product Selection */}
      <div className="lg:col-span-1 xl:col-span-2 bg-white rounded-lg p-4 flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input placeholder="Scan barcode or search item..." className="pl-10 h-12" />
          <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>

        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex justify-between items-center w-full mb-2">
            <p className="text-xs font-semibold text-gray-500">CATEGORIES</p>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
             <Carousel opts={{ align: "start", slidesToScroll: 'auto' }} className="w-full mb-4">
              <CarouselContent className="-ml-2">
                <CarouselItem className="basis-auto pl-2">
                    <Button variant={activeCategory === null ? 'secondary' : 'outline'} size="sm" onClick={() => setActiveCategory(null)} className="bg-gray-100 border-gray-200">
                      All
                    </Button>
                </CarouselItem>
                {quickAccessCategories.map(cat => (
                  <CarouselItem key={cat} className="basis-auto pl-2">
                    <Button variant={activeCategory === cat ? 'secondary' : 'outline'} size="sm" onClick={() => setActiveCategory(activeCategory === cat ? null : cat)} className="bg-gray-100 border-gray-200">
                      {cat}
                    </Button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2" />
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2" />
            </Carousel>
          </CollapsibleContent>
        </Collapsible>


        <p className="text-xs font-semibold text-gray-500 mb-2">PRODUCTS</p>
        <ScrollArea className="flex-grow">
          <div className="space-y-2 pr-4">
            {products?.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-4">
                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md bg-gray-200 object-cover" data-ai-hint={product.imageHint} />
                <div className="flex-grow">
                  <p className="font-medium text-sm">{product.name}</p>
                  <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                </div>
                <p className="font-semibold text-sm">R{product.price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="lg:col-span-1 xl:col-span-3 bg-white rounded-lg p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Current Sale #8832</h2>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={clearCart}>Clear All</Button>
        </div>

        <ScrollArea className="flex-grow -mx-4">
          <div className="px-4">
          {cartItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map(item => (
                <Card key={item.productId} className="p-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-grow">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-500">R {item.unitPrice.toFixed(2)} / unit</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <p className="font-bold w-24 text-right">R {item.totalPrice.toFixed(2)}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => updateQuantity(item.productId, 0)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>

        <div className="mt-auto pt-4 border-t-2 border-dashed">
          <div className="text-sm text-gray-500 space-y-1 mb-4">
             <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">R {cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT (15%):</span>
              <span className="font-medium">R {vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Items:</span>
              <span className="font-medium">{cartItems.reduce((acc, item) => acc + item.quantity, 0)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold">Total To Pay</span>
            <span className="text-3xl font-bold text-green-600">R {cartTotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <Button size="lg" className="h-16 text-lg bg-green-500 hover:bg-green-600 text-white col-span-1" onClick={() => handleCheckout('Cash')}>
              CASH
              <span className="text-xs ml-2 opacity-80">(F12 KEY)</span>
            </Button>
            <Button size="lg" variant="outline" className="h-16 text-lg col-span-1" onClick={() => handleCheckout('Card')}>
              <CreditCard className="mr-2"/> CARD / Yoco
            </Button>
             <Button size="lg" variant="outline" className="h-16 text-lg col-span-1">
              <MoreHorizontal className="mr-2"/> MORE
            </Button>
          </div>

          <Separator className="my-3"/>

          <div className="flex justify-around items-center text-sm font-medium">
             <Button variant="ghost" className="flex-1">
                <User className="mr-2 h-4 w-4"/>
                Add Customer
              </Button>
              <Button variant="ghost" className="flex-1">
                <Ticket className="mr-2 h-4 w-4"/>
                Redeem Voucher
              </Button>
              <Button variant="ghost" className="flex-1">
                <Search className="mr-2 h-4 w-4"/>
                Search Products
              </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
