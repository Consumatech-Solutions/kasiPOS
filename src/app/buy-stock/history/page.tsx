'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '@/components/settings-provider';
import type { PurchaseOrder } from '@/types';
import { format } from 'date-fns';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function BuyStockHistoryPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      if (!currentStore) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await purchaseOrdersApi.getAll({ page: 1, limit: 10 });
        const orders = Array.isArray(response.data) ? response.data : response.data.data;
        // Sort by date descending
        const sortedOrders = orders.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
          return dateB - dateA;
        });
        setPurchaseOrders(sortedOrders);
      } catch (error) {
        console.error('Failed to load purchase orders:', error);
        setPurchaseOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [currentStore]);

  return (
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
                    <CardTitle>Purchase Order History</CardTitle>
                    <CardDescription>View your past orders from suppliers.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Loading purchase orders...</p>
            </div>
          ) : purchaseOrders && purchaseOrders.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {purchaseOrders.map((order: any) => {
                const orderDate = order.createdAt ? new Date(order.createdAt) : (order.date ? new Date(order.date) : new Date());
                return (
                  <AccordionItem value={`item-${order.id}`} key={order.id}>
                    <AccordionTrigger>
                       <div className="flex justify-between w-full pr-4 items-center">
                        <div className="text-left">
                          <p className="font-mono font-medium">{order.orderCode}</p>
                          <p className="text-sm text-muted-foreground">{format(orderDate, 'PPP')}</p>
                        </div>
                         <div className="hidden sm:block">
                            <Badge variant={order.status === 'pending' ? 'secondary' : 'default'} className="capitalize">{order.status}</Badge>
                         </div>
                        <div className="text-right">
                           <p className="font-semibold text-lg">R{Number(order.total || 0).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground capitalize">{order.deliveryMethod}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                  <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Group Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item: any) => (
                            <TableRow key={item.productId}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>R{Number(item.groupPrice || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right">R{Number(item.totalPrice || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="text-right mt-4 space-y-1 text-sm">
                          <div className="flex justify-end gap-4">
                              <span className="text-muted-foreground">Subtotal:</span>
                              <span>R{Number(order.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-end gap-4">
                              <span className="text-muted-foreground">Delivery Fee:</span>
                              <span>R{Number(order.deliveryFee || 0).toFixed(2)}</span>
                          </div>
                           <div className="flex justify-end gap-4 font-bold text-base border-t pt-2 mt-2">
                              <span className="">Total:</span>
                              <span>R{Number(order.total || 0).toFixed(2)}</span>
                          </div>
                      </div>
                  </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="mx-auto h-12 w-12" />
              <p className="mt-4">You haven't placed any purchase orders yet.</p>
               <Button asChild variant="link">
                  <Link href="/buy-stock">Create a New Order</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
