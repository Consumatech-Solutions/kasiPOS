
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RequestAccessPage() {
  return (
     <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Request Access</CardTitle>
          <CardDescription>Enter your mobile number to receive a one-time access code.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-full bg-gray-300 rounded animate-pulse" />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
