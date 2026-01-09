
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome Back!</CardTitle>
          <CardDescription>Enter your details to sign in to your store</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Form will be added in Phase 2 */}
            <div className="space-y-4">
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-full bg-gray-300 rounded animate-pulse" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
                First time here? <Button variant="link" className="p-0">Request Access</Button>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
