'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { History } from 'lucide-react';

export default function BuyStockPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Buy Stock</CardTitle>
                <CardDescription>Order from suppliers to replenish your inventory.</CardDescription>
            </div>
            <Button asChild variant="outline">
                <Link href="/buy-stock/history">
                    <History className="mr-2 h-4 w-4" />
                    Order History
                </Link>
            </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16 text-muted-foreground">
            <p>Supplier catalogue will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
