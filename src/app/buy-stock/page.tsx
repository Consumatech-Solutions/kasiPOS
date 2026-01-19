'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { db } from '@/lib/db';
import type { Product, PurchaseOrderItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { History, ShoppingCart, Info, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BuyStockPage() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { currentStore } = settings;

  const allProducts = useLiveQuery(() => {
    if (!currentStore) return [];
    return db.products.where('storeId').equals(currentStore.id!).toArray();
  }, [currentStore?.id]);

  // State to manage quantities for each product
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const lowStockItems = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(p => p.lowStockThreshold && p.stock <= p.lowStockThreshold);
  }, [allProducts]);

  const handleQuantityChange = (productId: number, value: string) => {
    const newQuantity = parseInt(value, 10);
    setQuantities(prev => ({
      ...prev,
      [productId]: isNaN(newQuantity) ? 0 : newQuantity,
    }));
  };
  
  const getGroupPrice = (costPrice: number) => {
    if (typeof costPrice !== 'number') return 0;
    return costPrice * 0.9; // Simulate a 10% discount for group buying
  };
  
  const handleAddToCart = (product: Product) => {
    const quantity = quantities[product.id!] || 0;
    if (quantity <= 0) {
      toast({
        variant: 'destructive',
        title: "No quantity specified",
        description: "Please enter a quantity to add the item to your cart.",
      });
      return;
    }
    
    const costPrice = product.costPrice || 0;
    
    const newItem: PurchaseOrderItem = {
      productId: product.id!,
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
    
    toast({
      title: "Added to Purchase Order",
      description: `${quantity} x ${product.name} added to your cart.`,
    });
  };

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Buy Stock</CardTitle>
                <CardDescription>Order from suppliers to replenish your inventory.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                    <Link href="/buy-stock/history">
                        <History className="mr-2 h-4 w-4" />
                        Order History
                    </Link>
                </Button>
                 <Button asChild>
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead>Group Price</TableHead>
                                <TableHead className="w-[100px]">Quantity</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {lowStockItems.map(product => (
                                <TableRow key={product.id} className="bg-amber-50 hover:bg-amber-100">
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="destructive">{product.stock} left</Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold text-green-600">
                                        R{(getGroupPrice(product.costPrice || 0)).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            min="0"
                                            className="h-9"
                                            placeholder="0"
                                            value={quantities[product.id!] || ''}
                                            onChange={(e) => handleQuantityChange(product.id!, e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => handleAddToCart(product)}>
                                            <Plus /> Add
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <div>
                <h3 className="text-lg font-semibold mb-2">Full Supplier Catalogue</h3>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead>Unit Price</TableHead>
                            <TableHead>Group Price</TableHead>
                             <TableHead className="w-[100px]">Quantity</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProducts?.map(product => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.stock}</TableCell>
                                <TableCell>R{(product.costPrice || 0).toFixed(2)}</TableCell>
                                <TableCell className="font-semibold text-green-600">R{(getGroupPrice(product.costPrice || 0)).toFixed(2)}</TableCell>
                                <TableCell>
                                     <Input 
                                        type="number"
                                        min="0"
                                        className="h-9"
                                        placeholder="0"
                                        value={quantities[product.id!] || ''}
                                        onChange={(e) => handleQuantityChange(product.id!, e.target.value)}
                                     />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleAddToCart(product)}>
                                        <Plus /> Add
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

        </CardContent>
      </Card>
    </div>
  );
}
