'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BuyStockHistoryPage() {
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
          <div className="text-center py-16 text-muted-foreground">
            <p>A list of past purchase orders will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
