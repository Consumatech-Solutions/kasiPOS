"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ResetPasswordVerifyContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email")?.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            Reset link required
          </CardTitle>
          <CardDescription className="text-sm">
            This password reset flow has changed. Please use the reset link from
            your email/SMS{email ? ` for ${email}` : ""} to set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full min-h-[44px] touch-target">
            <Link href="/forgot-password">Go to Forgot password</Link>
          </Button>
          <Button
            variant="link"
            className="p-0 min-h-[44px] touch-target"
            asChild
          >
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          Loading...
        </div>
      }
    >
      <ResetPasswordVerifyContent />
    </Suspense>
  );
}
