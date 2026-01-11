'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BuyStockCartPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Supplier Cart</CardTitle>
          <CardDescription>Review and place your purchase order.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16 text-muted-foreground">
            <p>Your purchase order cart will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
