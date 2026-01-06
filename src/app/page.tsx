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
import { Plus, Minus, Trash2, User, Ticket, Search, QrCode, CreditCard, MoreHorizontal, ChevronDown, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


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

  const handleCheckout = async (method: 'Cash' | 'Card' | 'Mobile Money') => {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 h-full p-4 bg-gray-50">
      {/* Product Selection */}
      <div className="lg:col-span-1 xl:col-span-3 bg-white rounded-lg p-4 flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input placeholder="Scan barcode or search item..." className="pl-10 h-12" />
          <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>

        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex justify-between items-center w-full mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Categories</p>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
             <Carousel opts={{ align: "start", slidesToScroll: 'auto' }} className="w-full mb-4">
              <CarouselContent className="-ml-2">
                <CarouselItem className="basis-auto pl-2">
                    <Button variant={activeCategory === null ? 'secondary' : 'outline'} size="sm" onClick={() => setActiveCategory(null)}>
                      All
                    </Button>
                </CarouselItem>
                {quickAccessCategories.map(cat => (
                  <CarouselItem key={cat} className="basis-auto pl-2">
                    <Button variant={activeCategory === cat ? 'secondary' : 'outline'} size="sm" onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}>
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


        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Products</p>
        <ScrollArea className="flex-grow pr-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">View</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{product.name}</DialogTitle>
                        </DialogHeader>
                        <div className="flex items-center justify-center">
                          <Image 
                            src={product.imageUrl} 
                            alt={product.name} 
                            width={300} 
                            height={300} 
                            className="rounded-md object-cover"
                            data-ai-hint={product.imageHint}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>R{product.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => addToCart(product)}>
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="lg:col-span-1 xl:col-span-2 bg-white rounded-lg p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4 border-b pb-3 h-[15%]">
            <div>
                <h2 className="font-semibold text-lg">Sale #8822</h2>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                    <User className="mr-2 h-4 w-4"/>
                    Add Customer
                </Button>
                <Button variant="ghost" size="sm">
                    <Ticket className="mr-2 h-4 w-4"/>
                    Redeem Voucher
                </Button>
            </div>
        </div>

        <ScrollArea className="-mx-4 h-[55%]">
          <div className="px-4">
          {cartItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map(item => (
                <div key={item.productId} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                  <Image src={item.imageUrl || ''} alt={item.productName} width={40} height={40} className="rounded-md bg-gray-200 object-cover" />
                  <div className="flex-grow">
                    <p className="font-medium text-sm">{item.productName}</p>
                    <p className="text-xs text-gray-500">R {item.unitPrice.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <p className="font-semibold text-sm w-20 text-right">R{item.totalPrice.toFixed(2)}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => updateQuantity(item.productId, 0)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>

        {cartItems.length > 0 && (
          <div className="pt-4 border-t h-[30%]">
            <div className="text-sm space-y-2 mb-4">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>R {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>VAT (15%)</span>
                <span>R {vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Items:</span>
                <span>{cartItems.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 rounded-lg">
              <span className="text-lg font-bold">Total to Pay</span>
              <span className="text-2xl font-bold">R {cartTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button size="lg" className="h-14 text-base bg-green-500 hover:bg-green-600 text-white" onClick={() => handleCheckout('Cash')}>
                CASH
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => handleCheckout('Card')}>
                CARD
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => handleCheckout('Mobile Money')}>
                MOBILE
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
