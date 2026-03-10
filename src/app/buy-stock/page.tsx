'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { PurchaseOrderItem } from '@/types';
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
import { useSettings } from '@/components/settings-provider';
import { useProducts } from '@/hooks/use-catalogue';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { RequireOnlineBanner } from '@/components/require-online-banner';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { History, ShoppingCart, Info, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BuyStockPage() {
  const { settings } = useSettings();
  const { isOnline } = useNetworkStatus();
  const { currentStore } = settings;

  // Use API hook for products
  const { products: apiProducts, loading: productsLoading } = useProducts(1, 10);
  const allProducts = apiProducts || [];

  // State to manage quantities for each product (using string IDs for UUIDs)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const lowStockItems = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter((p: any) => (p.lowStockThreshold || 0) > 0 && (p.stock ?? 0) <= (p.lowStockThreshold || 0));
  }, [allProducts]);

  const handleQuantityChange = (productId: string, value: string) => {
    const newQuantity = parseInt(value, 10);
    setQuantities(prev => ({
      ...prev,
      [productId]: isNaN(newQuantity) ? 0 : newQuantity,
    }));
  };
  
  const getGroupPrice = (costPrice: number | string) => {
    const numPrice = Number(costPrice) || 0;
    return numPrice * 0.9; // Simulate a 10% discount for group buying
  };
  
  const handleAddToCart = (product: any) => {
    if (!product.id) return;
    
    const quantity = quantities[product.id] || 0;
    if (quantity <= 0) {
      feedback.error('No quantity', 'Enter a quantity to add the item to your cart.', 'Enter a number greater than 0.', { code: ERROR_CODES.PURCHASE_ORDER });
      return;
    }
    
    const costPrice = Number(product.costPrice) || 0;
    
    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: costPrice,
      groupPrice: getGroupPrice(costPrice),
      totalPrice: quantity * getGroupPrice(costPrice),
    };

    const cart: PurchaseOrderItem[] = JSON.parse(localStorage.getItem('purchaseOrderCart') || '[]');
    const existingItemIndex = cart.findIndex(item => item.productId === product.id);

    if (existingItemIndex > -1) {
      cart[existingItemIndex].quantity += quantity;
      cart[existingItemIndex].totalPrice = cart[existingItemIndex].quantity * cart[existingItemIndex].groupPrice;
    } else {
      cart.push(newItem);
    }
    
    localStorage.setItem('purchaseOrderCart', JSON.stringify(cart));
    
    feedback.success('Added to cart', `${quantity} × ${product.name} added to your purchase order cart.`);
  };

  return (
    <div className="p-2 sm:p-4 space-y-4 sm:space-y-6">
      <RequireOnlineBanner />
      <div className={cn(!isOnline && 'opacity-60 pointer-events-none select-none')}>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle className="text-lg sm:text-xl">Buy Stock</CardTitle>
                <CardDescription className="text-sm">Order from suppliers to replenish your inventory.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button asChild variant="outline" className="min-h-[44px] touch-target w-full sm:w-auto">
                    <Link href="/buy-stock/history">
                        <History className="mr-2 h-4 w-4" />
                        Order History
                    </Link>
                </Button>
                 <Button asChild className="min-h-[44px] touch-target w-full sm:w-auto">
                    <Link href="/buy-stock/cart">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        View Cart
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
                <Info className="h-4 w-4 !text-blue-800" />
                <AlertTitle>Group Buying Power!</AlertTitle>
                <AlertDescription>
                    The <span className="font-bold">Group Price</span> is an estimated cost based on aggregated orders from stores near you. Order together to save!
                </AlertDescription>
            </Alert>
            
             {lowStockItems && lowStockItems.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-2">Low Stock Items</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        These items are running low. Consider reordering them now.
                    </p>
                    <div className="overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="hidden sm:table-cell">Stock</TableHead>
                                  <TableHead>Group Price</TableHead>
                                  <TableHead className="w-[100px]">Quantity</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                          </TableHeader>
                           <TableBody>
                              {lowStockItems.map((product: any) => (
                                  <TableRow key={product.id} className="bg-amber-50 hover:bg-amber-100">
                                      <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                          <span>{product.name}</span>
                                          <span className="text-xs text-muted-foreground sm:hidden">
                                            <Badge variant="destructive" className="mt-1 w-fit">{product.stock ?? 0} left</Badge>
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="hidden sm:table-cell">
                                          <Badge variant="destructive">{product.stock ?? 0} left</Badge>
                                      </TableCell>
                                      <TableCell className="font-semibold text-green-600">
                                          R{(getGroupPrice(Number(product.costPrice) || 0)).toFixed(2)}
                                      </TableCell>
                                      <TableCell>
                                          <Input 
                                              type="number" 
                                              min="0"
                                              className="h-10 sm:h-9 touch-target"
                                              placeholder="0"
                                              value={quantities[product.id] || ''}
                                              onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                          />
                                      </TableCell>
                                      <TableCell className="text-right">
                                          <Button size="sm" className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => handleAddToCart(product)}>
                                              <Plus /> <span className="hidden sm:inline">Add</span>
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-lg font-semibold mb-2">Full Supplier Catalogue</h3>
                 <div className="overflow-x-auto">
                   <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="hidden sm:table-cell">Current Stock</TableHead>
                              <TableHead className="hidden md:table-cell">Unit Price</TableHead>
                              <TableHead>Group Price</TableHead>
                               <TableHead className="w-[100px]">Quantity</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {productsLoading ? (
                              <TableRow>
                                  <TableCell colSpan={6} className="text-center py-10">Loading products...</TableCell>
                              </TableRow>
                          ) : allProducts?.map((product: any) => (
                              <TableRow key={product.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-muted-foreground sm:hidden">Stock: {product.stock ?? 0}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">{product.stock ?? 0}</TableCell>
                                  <TableCell className="hidden md:table-cell">R{(Number(product.costPrice) || 0).toFixed(2)}</TableCell>
                                  <TableCell className="font-semibold text-green-600">R{(getGroupPrice(Number(product.costPrice) || 0)).toFixed(2)}</TableCell>
                                  <TableCell>
                                       <Input 
                                          type="number"
                                          min="0"
                                          className="h-10 sm:h-9 touch-target"
                                          placeholder="0"
                                          value={quantities[product.id] || ''}
                                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                       />
                                  </TableCell>
                                  <TableCell className="text-right">
                                      <Button size="sm" className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => handleAddToCart(product)}>
                                          <Plus /> <span className="hidden sm:inline">Add</span>
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                 </div>
            </div>

        </CardContent>
      </Card>
      </div>
    </div>
  );
}
