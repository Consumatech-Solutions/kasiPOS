'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import type { Product, Transaction, TransactionItem, Customer } from '@/types';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, User, Search, QrCode, CreditCard, LayoutGrid, List, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import PaymentModal from '@/components/pos/PaymentModal';

const quickAccessCategories = ['Bread', 'Airtime', 'Dairy', 'Cigs', 'Veg', 'Cool Drinks', 'Snacks', 'Groceries', 'Beverages', 'Toiletries'];

const storeNames: Record<string, string> = {
  'takealot': 'Takealot',
  'amazon': 'Amazon',
  'makro': 'Makro',
  'temu': 'Temu',
  'checkers-hyper': 'Checkers Hyper',
  'pnp-hyper': 'Pick n Pay Hyper',
  'bash': 'Bash',
  'tfg': 'TFG',
};

export default function StorePosPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const storeName = storeNames[storeId] || 'Marketplace';

  const [cart, setCart] = useState<Map<number, TransactionItem>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryView, setCategoryView] = useState<'carousel' | 'grid'>('carousel');
  const [categorySearch, setCategorySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [activePaymentMethod, setActivePaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Money' | null>(null);
  
  const { toast } = useToast();

  const allProducts = useLiveQuery(() => db.products.toArray(), []);
  
  const products = useMemo(() => {
    if (!allProducts) return [];
    let filtered = allProducts;
    if (activeCategory) {
      filtered = filtered.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
    }
    if (productSearch) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch));
    }
    return filtered;
  }, [allProducts, activeCategory, productSearch]);

  const allCategories = useMemo(() => {
    if (!allProducts) return [];
    const categories = new Set(allProducts.map(p => p.category));
    return Array.from(categories);
  }, [allProducts]);

  const filteredCategories = useMemo(() => {
    if (!allCategories) return [];
    return allCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategories, categorySearch]);
  
  const allCustomers = useLiveQuery(() => db.customers.toArray(), []);
  const selectedCustomer = useLiveQuery(() => selectedCustomerId ? db.customers.get(selectedCustomerId) : Promise.resolve(undefined), [selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    return allCustomers.filter(customer => 
        customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
        customer.phone?.includes(customerSearchTerm)
    );
  }, [allCustomers, customerSearchTerm]);

  const selectCategory = (category: string | null) => {
    setActiveCategory(category);
    setCategoryView('carousel');
  };

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

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const vat = cartSubtotal * 0.15;
  const cartTotal = cartSubtotal; 

  const handleCheckout = (method: 'Cash' | 'Card' | 'Mobile Money') => {
    if (cart.size === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add products to the cart before checkout.",
        variant: 'destructive'
      });
      return;
    }
    if (!selectedCustomerId) {
      toast({
        title: "No customer selected",
        description: "Please select a customer for this marketplace order.",
        variant: 'destructive'
      });
      return;
    }
    setActivePaymentMethod(method);
  };
  
  const handleCustomerSelect = (customerId: number) => {
      setSelectedCustomerId(customerId);
      setCustomerDialogOpen(false);
  }

  // Placeholder for Phase 2
  const handleCompleteSale = async (transactionDetails: Omit<Transaction, 'id' | 'date'>) => {
     console.log("Sale to be completed with:", transactionDetails);
     setActivePaymentMethod(null);
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 h-full p-4 bg-slate-50">
      {/* Product Selection */}
      <div className="lg:col-span-1 xl:col-span-3 bg-white rounded-lg p-4 flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input 
            placeholder={categoryView === 'grid' ? "Search categories..." : "Scan barcode or search item..."}
            className="pl-10 h-12"
            value={categoryView === 'grid' ? categorySearch : productSearch}
            onChange={(e) => categoryView === 'grid' ? setCategorySearch(e.target.value) : setProductSearch(e.target.value)}
          />
          <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>

        <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Categories</p>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCategoryView(prev => prev === 'carousel' ? 'grid' : 'carousel')}>
                {categoryView === 'carousel' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
        </div>

        {categoryView === 'carousel' ? (
            <Carousel opts={{ align: "start", slidesToScroll: 'auto' }} className="w-full mb-4">
            <CarouselContent className="-ml-2">
              <CarouselItem className="basis-auto pl-2">
                  <Button variant={activeCategory === null ? 'secondary' : 'outline'} size="sm" onClick={() => selectCategory(null)}>
                    All
                  </Button>
              </CarouselItem>
              {quickAccessCategories.map(cat => (
                <CarouselItem key={cat} className="basis-auto pl-2">
                  <Button variant={activeCategory === cat ? 'secondary' : 'outline'} size="sm" onClick={() => selectCategory(activeCategory === cat ? null : cat)}>
                    {cat}
                  </Button>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2" />
            <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2" />
          </Carousel>
        ) : null}


        {categoryView === 'grid' ? (
            <ScrollArea className="flex-grow pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <button onClick={() => selectCategory(null)} className={`aspect-square rounded-lg flex items-center justify-center text-center p-2 transition-colors ${activeCategory === null ? 'bg-secondary text-secondary-foreground' : 'bg-card hover:bg-accent hover:text-accent-foreground border'}`}>
                        <p className="font-semibold">All</p>
                    </button>
                    {filteredCategories?.map(cat => (
                        <button key={cat} onClick={() => selectCategory(cat)} className={`aspect-square rounded-lg flex items-center justify-center text-center p-2 transition-colors ${activeCategory === cat ? 'bg-secondary text-secondary-foreground' : 'bg-card hover:bg-accent hover:text-accent-foreground border'}`}>
                            <p className="font-semibold">{cat}</p>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Cart Section */}
      <div className="lg:col-span-1 xl:col-span-2 bg-white rounded-lg flex flex-col h-full">
        {/* Child 1: Header */}
        <div className="p-4 border-b shrink-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                        <Link href="/marketplace">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Back to Marketplace</span>
                        </Link>
                    </Button>
                    <h2 className="font-semibold text-lg">Order for {storeName}</h2>
                </div>
                <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setCustomerSearchTerm('')}>
                            <User className="mr-2 h-4 w-4"/>
                            {selectedCustomer ? selectedCustomer.name : 'Add Customer'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Select a Customer</DialogTitle>
                         <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input 
                                placeholder="Search by name or phone number..."
                                className="pl-10"
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            />
                        </div>
                      </DialogHeader>
                      <ScrollArea className="max-h-[50vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers?.map(customer => (
                                    <TableRow key={customer.id} className="cursor-pointer hover:bg-muted" onClick={() => handleCustomerSelect(customer.id!)}>
                                        <TableCell>{customer.name}</TableCell>
                                        <TableCell>{customer.phone}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm">Select</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        </div>

        {/* Child 2: Cart Items */}
        <div style={{ height: '35%' }}>
          <ScrollArea className="h-full">
            {cartItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
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
          </ScrollArea>
        </div>

        {/* Child 3: Payment Section */}
        {cartItems.length > 0 && (
          <div className="pt-4 p-4 border-t" style={{ height: '65%' }}>
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
                  <span>Service Fee</span>
                  <span>R 15.00</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 rounded-lg">
              <span className="text-lg font-bold">Total to Pay</span>
              <span className="text-2xl font-bold">R {(cartTotal + 15).toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button size="lg" className="h-14 text-base bg-green-500 hover:bg-green-600 text-white" onClick={() => handleCheckout('Cash')} disabled={!selectedCustomerId}>
                  CASH
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => handleCheckout('Card')} disabled={!selectedCustomerId}>
                  CARD
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => handleCheckout('Mobile Money')} disabled={!selectedCustomerId}>
                  MOBILE
              </Button>
            </div>
             {!selectedCustomerId && cartItems.length > 0 && <p className="text-center text-sm text-destructive mt-2">Please select a customer to proceed with the order.</p>}
          </div>
        )}
      </div>
    </div>
    
    <PaymentModal
        isOpen={!!activePaymentMethod}
        onClose={() => setActivePaymentMethod(null)}
        method={activePaymentMethod}
        cartTotal={cartTotal + 15} // Including service fee in total for marketplace
        cartItems={cartItems}
        onCompleteSale={handleCompleteSale}
        customer={selectedCustomer}
    />

    {/* Customer Selection Dialog */}
    <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select a Customer</DialogTitle>
             <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                    placeholder="Search by name or phone number..."
                    className="pl-10"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                />
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredCustomers?.map(customer => (
                        <TableRow key={customer.id} className="cursor-pointer hover:bg-muted" onClick={() => handleCustomerSelect(customer.id!)}>
                            <TableCell>{customer.name}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm">Select</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
    </Dialog>
    </>
  );
}
