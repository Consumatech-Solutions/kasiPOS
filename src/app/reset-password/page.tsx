"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { PasswordInput } from "@/components/auth/password-input";

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
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token")?.trim() ?? "";

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    try {
      if (!token) {
        feedback.error(
          "Reset link missing",
          "The reset token is missing from the URL.",
          "Request a new reset link and try again.",
          { code: ERROR_CODES.RESET_PASSWORD }
        );
        router.push("/forgot-password");
        return;
      }

      await authApi.resetPassword({
        token,
        newPassword: values.newPassword,
      });

      feedback.success(
        "Password reset successfully",
        "Your password has been updated. You can now sign in."
      );
      router.push("/login");
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      if (status === 401) {
        feedback.error(
          "Invalid or expired reset link",
          serverMessage || "Please request a new reset link and try again.",
          "Go back to Forgot password to resend a link.",
          { code: ERROR_CODES.RESET_PASSWORD }
        );
        router.push("/forgot-password");
        return;
      }

      // Covers 400 validation errors (and any other non-401 cases).
      feedback.fromError(
        error,
        "Password reset failed",
        serverMessage ||
          "Ensure your password meets the requirements and try again.",
        ERROR_CODES.RESET_PASSWORD
      );
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-lg sm:text-xl">
              Reset link missing
            </CardTitle>
            <CardDescription className="text-sm">
              We couldn't find a reset token in the URL. Request a new password
              reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              className="w-full min-h-[44px] touch-target"
              onClick={() => router.push("/forgot-password")}
            >
              Go back
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Button
                variant="link"
                className="p-0 min-h-[44px] touch-target"
                asChild
              >
                <Link href="/login">Back to sign in</Link>
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Set new password</CardTitle>
          <CardDescription className="text-sm">
            Choose a new password. This will replace your current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        className="touch-target"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        className="touch-target"
                        autoComplete="new-password"
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
                Set new password
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/login">Back to sign in</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
