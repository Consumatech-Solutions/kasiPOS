'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMarketplaceOrders } from '@/hooks/use-marketplace-orders';
import { useMarketplaceStores } from '@/hooks/use-marketplace-stores';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MarketplaceOrderItem } from '@/lib/api/marketplace-orders';


export default function MarketplacePage() {
  const [orderCode, setOrderCode] = useState('');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const { toast } = useToast();
  const { findByOrderCode, foundOrder, searchLoading } = useMarketplaceOrders({ autoLoad: false });
  const { stores: marketplaces, loading: storesLoading } = useMarketplaceStores({ activeOnly: true, autoLoad: true });

  const handleSearch = async () => {
    if (!orderCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an order code.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const order = await findByOrderCode(orderCode.trim());
      setSearchDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Order Not Found',
        description: error?.response?.data?.message || 'No order found with this code.',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketplace</CardTitle>
          <CardDescription>Place orders from third-party stores for your customers.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="max-w-md space-y-2">
                <label htmlFor="order-code" className="text-sm font-medium">Have an Order Code?</label>
                <div className="flex gap-2">
                    <Input 
                      id="order-code" 
                      placeholder="Enter order code..." 
                      value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={searchLoading}
                    />
                    <Button onClick={handleSearch} disabled={searchLoading}>
                        {searchLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        Find Order
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Available Stores</h2>
        <Button variant="outline" asChild>
          <Link href="/marketplace/orders">
            View Orders
          </Link>
        </Button>
      </div>
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {marketplaces.map((store) => (
            <Link href={`/marketplace/${store.code}`} key={store.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                <CardHeader className="flex-row items-center gap-4">
                    <Image 
                      src={store.logoUrl || '/placeholder-store.png'} 
                      alt={`${store.name} logo`} 
                      width={80} 
                      height={40} 
                      className="rounded-md object-contain"
                      unoptimized
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-store.png'; }}
                    />
                    <div>
                        <CardTitle>{store.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{store.description || 'No description available.'}</p>
                </CardContent>
                </Card>
            </Link>
          ))}
        </div>
      </div>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Order Code: {foundOrder?.orderCode}
            </DialogDescription>
          </DialogHeader>
          {foundOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Marketplace Store</p>
                  <p className="text-sm">{marketplaces.find(m => m.code === foundOrder.marketplaceStoreId)?.name || foundOrder.marketplaceStoreId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge variant={foundOrder.status === 'completed' ? 'default' : foundOrder.status === 'cancelled' ? 'destructive' : 'secondary'}>
                    {foundOrder.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Payment Method</p>
                  <p className="text-sm">{foundOrder.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="text-sm">{new Date(foundOrder.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foundOrder.items.map((item: MarketplaceOrderItem, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">R{(Number(item.unitPrice) || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">R{(Number(item.totalPrice) || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>R{(Number(foundOrder.subtotal) || 0).toFixed(2)}</span>
                </div>
                {foundOrder.vatAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">VAT</span>
                    <span>R{(Number(foundOrder.vatAmount) || 0).toFixed(2)}</span>
                  </div>
                )}
                {foundOrder.serviceFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Service Fee</span>
                    <span>R{(Number(foundOrder.serviceFee) || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span>R{(Number(foundOrder.total) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
