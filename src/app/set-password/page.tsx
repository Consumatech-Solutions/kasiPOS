
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>Create a secure password to protect your account.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-full bg-gray-300 rounded animate-pulse" />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
