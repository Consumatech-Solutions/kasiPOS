"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { useSettings } from "@/components/settings-provider";
import { useQueryClient } from "@tanstack/react-query";
import { runManualFullCloudSync } from "@/lib/cloud-data-pull";
import { offlineDetector } from "@/lib/offline-detector";
import { saveStorePermanently } from "@/lib/store-persistence";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";

const verifySignupSchema = z.object({
  code: z
    .string()
    .length(6, { message: "Code must be exactly 6 digits." })
    .regex(/^\d{6}$/, { message: "Code must be 6 digits." }),
});

function VerifySignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams?.get("email")?.trim() ?? "";
  const { login, setSetting } = useSettings();
  const queryClient = useQueryClient();
  const isDev = process.env.NODE_ENV === "development";

  const form = useForm<z.infer<typeof verifySignupSchema>>({
    resolver: zodResolver(verifySignupSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: z.infer<typeof verifySignupSchema>) => {
    if (!email) {
      feedback.error(
        "Verification failed",
        "No email address was provided.",
        "Go back to signup and enter your email.",
        { code: ERROR_CODES.SIGNUP_VERIFY }
      );
      router.push("/signup");
      return;
    }

    try {
      const response = await authApi.verifySignup({
        email,
        code: values.code,
      });

      if (!response.data?.accessToken || !response.data?.user) {
        feedback.error(
          "Verification failed",
          "Invalid response from server.",
          undefined,
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }

      feedback.success(
        "Account created",
        "Your store is ready. Welcome to KasiPOS!"
      );

      await login({
        ...response.data.user,
        accessToken: response.data.accessToken,
      });

      if (response.data.store) {
        await saveStorePermanently(response.data.store, setSetting);
      }

      try {
        const isOnline = await offlineDetector.forceCheck();
        if (isOnline) {
          await runManualFullCloudSync({
            queryClient,
            storeId: response.data.user.storeId,
          });
        }
      } catch (syncError) {
        console.error("Initial sync after signup failed:", syncError);
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      const status = err?.response?.status;
      if (status === 401) {
        feedback.error(
          "Invalid or expired code",
          "Invalid or expired code. Request a new signup or try again.",
          isDev ? "In development, use code 123456." : undefined,
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }
      if (status === 409) {
        feedback.error(
          "Already registered",
          "This email or phone is already registered.",
          "Try signing in instead.",
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }
      feedback.fromError(
        error,
        "Verification failed",
        "Check the code and try again.",
        ERROR_CODES.SIGNUP_VERIFY
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            Verify your email
          </CardTitle>
          <CardDescription className="text-sm">
            Enter the 6-digit code sent to
            {email ? ` ${email}` : " your email"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDev && (
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Development: use verification code <strong>123456</strong>.
            </p>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456"
                        inputMode="numeric"
                        maxLength={6}
                        className="touch-target"
                        autoComplete="one-time-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full min-h-[44px] touch-target"
              >
                Verify and continue
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Wrong email?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/signup">Start over</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifySignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          Loading...
        </div>
      }
    >
      <VerifySignupContent />
    </Suspense>
  );
}
