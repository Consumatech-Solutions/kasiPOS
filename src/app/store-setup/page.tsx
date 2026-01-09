
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function StoreSetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Store Setup</CardTitle>
          <CardDescription>Let's get your store ready for business.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Multi-step wizard will go here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
