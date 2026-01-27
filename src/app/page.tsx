'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';

import type { Product, Transaction, TransactionItem, Customer } from '@/types';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, User, Ticket, Search, QrCode, CreditCard, LayoutGrid, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import PaymentModal from '@/components/pos/PaymentModal';
import VoucherModal from '@/components/pos/VoucherModal';
import { useSettings } from '@/components/settings-provider';
import { useCustomers } from '@/hooks/use-customers';
import { useCategories, useProducts, productKeys } from '@/hooks/use-catalogue';
import { transactionsApi } from '@/lib/api/transactions';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { mutationQueue } from '@/lib/mutation-queue';



export default function PosPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<Map<string, TransactionItem>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryView, setCategoryView] = useState<'carousel' | 'grid'>('carousel');
  const [categorySearch, setCategorySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [activePaymentMethod, setActivePaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Money' | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedVoucherCode, setAppliedVoucherCode] = useState<string | undefined>(undefined);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  const { toast } = useToast();

  // API Hooks
  const { categories: apiCategories, loading: categoriesLoading } = useCategories(1, 10);
  const { products: apiProducts, loading: productsLoading, setFilters } = useProducts(1, 10);

  const products = apiProducts;

  // Memoize categoryId lookup to prevent infinite loops
  const categoryId = useMemo(() => {
    if (!activeCategory || !apiCategories) return undefined;
    return apiCategories.find(c => c.name === activeCategory)?.id;
  }, [activeCategory, apiCategories]);

  // Track previous categoryId to prevent unnecessary updates
  const prevCategoryIdRef = useRef<string | undefined>(undefined);

  // Debounce search and update filters
  useEffect(() => {
    const timer = setTimeout(() => {
        setFilters((prev: any) => ({ ...prev, search: productSearch }));
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update category filter only when categoryId actually changes
  useEffect(() => {
    if (categoryId !== prevCategoryIdRef.current) {
      prevCategoryIdRef.current = categoryId;
      setFilters((prev: any) => ({ ...prev, categoryId }));
    }
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCategories = useMemo(() => {
    if (!apiCategories) return [];
    return apiCategories.map(c => c.name);
  }, [apiCategories]);

  const filteredCategories = useMemo(() => {
    if (!allCategories) return [];
    return allCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategories, categorySearch]);
  
  // Use API hook for customers
  const { customers: allCustomersList } = useCustomers({ initialLimit: 10 });
  
  const customers = allCustomersList || [];

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId || !customers) return undefined;
    return customers.find((c) => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter((customer: Customer) =>
        customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        customer.contact?.includes(customerSearchTerm)
    );
  }, [customers, customerSearchTerm]);


  const selectCategory = (category: string | null) => {
    setActiveCategory(category);
    setCategoryView('carousel');
  };

  const addToCart = (product: Product) => {
    const productId = product.id;
    if (!productId) return;
    const unitPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price)) || 0;
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const existingItem = newCart.get(productId);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
      } else {
        newCart.set(productId, {
          productId: productId,
          productName: product.name,
          quantity: 1,
          unitPrice: unitPrice,
          totalPrice: unitPrice,
          imageUrl: (product as any).productImage || product.imageUrl,
          stock: product.stock,
        });
      }
      return newCart;
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
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
    setAppliedDiscount(0);
    setAppliedVoucherCode(undefined);
  }

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const vat = cartSubtotal * 0.15;
  const cartTotal = cartSubtotal - appliedDiscount;

  const handleOpenVoucherModal = () => {
    if (cartSubtotal < 5) {
      toast({
        variant: 'destructive',
        title: 'Cannot Redeem Voucher',
        description: 'You need a cart total of at least R5 to redeem a voucher.',
      });
      return;
    }
    setIsVoucherModalOpen(true);
  };

  const handleCheckout = (method: 'Cash' | 'Card' | 'Mobile Money') => {
    if (cart.size === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add products to the cart before checkout.",
        variant: 'destructive'
      });
      return;
    }
    setActivePaymentMethod(method);
  };

  const handleApplyVoucher = (code: string, amount: number) => {
    setAppliedVoucherCode(code);
    setAppliedDiscount(amount);
    toast({
        title: "Voucher Applied",
        description: `Discount of R${amount.toFixed(2)} applied.`,
    });
  };

  const handleCustomerSelect = (customerId: string) => {
      setSelectedCustomerId(customerId);
      setCustomerDialogOpen(false);
  }

  const [isCompletingSale, setIsCompletingSale] = useState(false);

  const handleCompleteSale = async (transactionDetails: Omit<Transaction, 'id' | 'date' | 'storeId'>) => {
    if (!currentStore) {
        toast({ variant: "destructive", title: "Error", description: "No store context found." });
        return;
    }

    setIsCompletingSale(true);
    const newTransaction: Omit<Transaction, 'id'> = {
      ...transactionDetails,
      date: new Date(),
      customerId: selectedCustomerId,
      voucherCode: appliedVoucherCode,
      discountAmount: appliedDiscount,
      total: cartTotal, // Use the final calculated total
      storeId: currentStore.id!,
    };
    
    if (isOnline) {
      // ONLINE: Use API - backend will update stock
      try {
        await transactionsApi.create({
          storeId: newTransaction.storeId,
          customerId: newTransaction.customerId ?? undefined,
          items: newTransaction.items,
          total: newTransaction.total,
          paymentMethod: newTransaction.paymentMethod,
          voucherCode: newTransaction.voucherCode ?? undefined,
          discountAmount: newTransaction.discountAmount ?? undefined,
        });

        // Save to local DB for history
        await db.transactions.add(newTransaction as Transaction);

        // Refresh products from API to get updated stock
        queryClient.invalidateQueries({ queryKey: productKeys.lists(), refetchType: 'all' });

        toast({
          title: "Sale Complete!",
          description: `Transaction has been processed successfully.`,
        });

        // Reset state
        clearCart();
        setSelectedCustomerId(undefined);
        setActivePaymentMethod(null);
      } catch (error) {
        console.error("Failed to complete sale:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to complete the sale. Please try again.",
        });
      } finally {
        setIsCompletingSale(false);
      }
    } else {
      // OFFLINE: Optimistically update and queue for later sync
      try {
        // 1. Optimistic cache update FIRST (synchronous, immediate UI feedback)
        const productQueryKeys = queryClient.getQueryCache().getAll().map(query => query.queryKey);
        const productQueries = productQueryKeys.filter(key => 
          Array.isArray(key) && key[0] === 'products'
        );

        // Update stock optimistically for all product queries
        productQueries.forEach(queryKey => {
          queryClient.setQueryData<{ data: any[]; meta: any }>(queryKey, (old) => {
            if (!old || !old.data) return old;
            return {
              ...old,
              data: old.data.map(product => {
                const cartItem = newTransaction.items.find(item => item.productId === product.id);
                if (cartItem) {
                  const currentStock = product.stock ?? 0;
                  const newStock = Math.max(0, currentStock - cartItem.quantity);
                  return { ...product, stock: newStock };
                }
                return product;
              }),
            };
          });
        });

        // 2. Save transaction to local IndexedDB
        await db.transactions.add(newTransaction as Transaction);

        // 3. Queue the transaction for sync when back online
        mutationQueue.add({
          mutationKey: ['transactions', 'create'],
          mutationFn: () => transactionsApi.create({
            storeId: newTransaction.storeId,
            customerId: newTransaction.customerId ?? undefined,
            items: newTransaction.items,
            total: newTransaction.total,
            paymentMethod: newTransaction.paymentMethod,
            voucherCode: newTransaction.voucherCode ?? undefined,
            discountAmount: newTransaction.discountAmount ?? undefined,
          }),
          variables: newTransaction,
        });

        // 4. Show success and clear cart
        toast({
          title: "Offline Sale Complete!",
          description: "Sale saved locally. Will sync when back online.",
        });

        clearCart();
        setSelectedCustomerId(undefined);
        setActivePaymentMethod(null);
      } catch (error) {
        console.error("Failed to complete offline sale:", error);
        
        // Rollback optimistic updates on error
        const productQueryKeys = queryClient.getQueryCache().getAll().map(query => query.queryKey);
        const productQueries = productQueryKeys.filter(key => 
          Array.isArray(key) && key[0] === 'products'
        );
        productQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });

        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save the sale locally. Please try again.",
        });
      } finally {
        setIsCompletingSale(false);
      }
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-4 h-full p-2 sm:p-4 bg-muted">
      {/* Product Selection */}
      <div className="lg:col-span-1 xl:col-span-3 bg-white dark:bg-card rounded-lg p-2 sm:p-4 flex flex-col">
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
            <Button variant="ghost" size="icon" className="h-10 w-10 touch-target" onClick={() => setCategoryView(prev => prev === 'carousel' ? 'grid' : 'carousel')}>
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
              {apiCategories.map(cat => (
                <CarouselItem key={cat.id} className="basis-auto pl-2">
                  <Button variant={activeCategory === cat.name ? 'secondary' : 'outline'} size="sm" onClick={() => selectCategory(activeCategory === cat.name ? null : cat.name)}>
                    {cat.name}
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
                    <TableHead className="w-[50px] hidden sm:table-cell">View</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden md:table-cell">Stock</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">Loading products...</TableCell>
                  </TableRow>
                ) : products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No products found.</TableCell>
                  </TableRow>
                ) : products?.map((product: any) => (
                    <TableRow key={product.id}>
                    <TableCell className="hidden sm:table-cell">
                        <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="touch-target">
                            <Eye className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                            <DialogHeader>
                            <DialogTitle>{product.name}</DialogTitle>
                            </DialogHeader>
                            <div className="flex items-center justify-center">
                            {isOnline && (product.productImage || product.imageUrl) ? (
                              <img 
                                src={product.productImage || product.imageUrl || '/placeholder-product.png'} 
                                alt={product.name} 
                                width={300} 
                                height={300} 
                                className="rounded-md object-cover max-w-full h-auto"
                                data-ai-hint={product.imageHint}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/placeholder-product.png';
                                }}
                              />
                            ) : (
                              <div className="w-[300px] h-[300px] rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                                {isOnline ? 'No image' : 'Offline - Image not available'}
                              </div>
                            )}
                            </div>
                        </DialogContent>
                        </Dialog>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground md:hidden">Stock: {product.stock ?? '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{product.stock ?? '-'}</TableCell>
                    <TableCell>R{(typeof product.price === 'number' ? product.price : parseFloat(product.price || 0)).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                        <Button size="sm" className="min-h-[44px] touch-target" onClick={() => addToCart(product)}>
                        <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Add</span>
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
      <div className="lg:col-span-1 xl:col-span-2 bg-white dark:bg-card rounded-lg p-2 sm:p-4 flex flex-col h-full lg:sticky lg:top-16">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 border-b pb-3 shrink-0">
            <div>
                <h2 className="font-semibold text-base sm:text-lg">Sale #8822</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                 <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="min-h-[44px] touch-target text-xs sm:text-sm" onClick={() => setCustomerSearchTerm('')}>
                            <User className="mr-1 sm:mr-2 h-4 w-4"/>
                            <span className="truncate max-w-[120px] sm:max-w-none">{selectedCustomer ? selectedCustomer.name : 'Add Customer'}</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
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
                                    {filteredCustomers?.map((customer: Customer) => (
                                        <TableRow
                                            key={customer.id}
                                            className="cursor-pointer hover:bg-muted"
                                            onClick={() => {
                                                handleCustomerSelect(customer.id);
                                            }}
                                        >
                                            <TableCell>{customer.name}</TableCell>
                                            <TableCell>{customer.contact}</TableCell>
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
                <Button variant="ghost" size="sm" className="min-h-[44px] touch-target text-xs sm:text-sm" onClick={handleOpenVoucherModal}>
                    <Ticket className="mr-1 sm:mr-2 h-4 w-4"/>
                    <span className="hidden sm:inline">Redeem Voucher</span>
                    <span className="sm:hidden">Voucher</span>
                </Button>
            </div>
        </div>

        <div className="flex-grow min-h-0">
          <ScrollArea className="h-full pr-4">
            {cartItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map(item => (
                  <div key={item.productId} className="flex items-center gap-2 sm:gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-muted/50">
                    <Image src={item.imageUrl || '/placeholder-product.png'} alt={item.productName} width={40} height={40} className="rounded-md bg-gray-200 object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }} />
                    <div className="flex-grow min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">R {(typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <span className="font-bold text-sm w-6 sm:w-4 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <p className="font-semibold text-xs sm:text-sm w-16 sm:w-20 text-right">R{(typeof item.totalPrice === 'number' ? item.totalPrice : parseFloat(String(item.totalPrice)) || 0).toFixed(2)}</p>
                    <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 text-gray-400 hover:text-red-500 touch-target" onClick={() => updateQuantity(item.productId, 0)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {cartItems.length > 0 && (
          <div className="pt-4 border-t shrink-0">
            <div className="text-sm space-y-2 mb-4">
              <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>R {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                  <span>VAT (15%)</span>
                  <span>R {vat.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between ${appliedDiscount > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  <span>Discount Applied</span>
                  <span>-R {appliedDiscount.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 dark:bg-muted rounded-lg">
              <span className="text-lg font-bold">Total to Pay</span>
              <span className="text-2xl font-bold">R {cartTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Button size="lg" className="h-12 sm:h-14 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white touch-target" onClick={() => handleCheckout('Cash')}>
                  CASH
              </Button>
              <Button size="lg" variant="outline" className="h-12 sm:h-14 text-sm sm:text-base touch-target" onClick={() => handleCheckout('Card')}>
                  CARD
              </Button>
              <Button size="lg" variant="outline" className="h-12 sm:h-14 text-sm sm:text-base touch-target" onClick={() => handleCheckout('Mobile Money')}>
                  MOBILE
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    <PaymentModal 
        isOpen={!!activePaymentMethod}
        onClose={() => setActivePaymentMethod(null)}
        method={activePaymentMethod}
        cartTotal={cartTotal}
        cartItems={cartItems}
        onCompleteSale={handleCompleteSale}
        customer={selectedCustomer}
        isLoading={isCompletingSale}
    />
    <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        customerId={selectedCustomerId}
        onApplyVoucher={handleApplyVoucher}
        cartTotal={cartSubtotal} // Pass subtotal before discount for validation
    />
    </>
  );
}
