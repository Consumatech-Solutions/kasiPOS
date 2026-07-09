"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { DEFAULT_PHONE_COUNTRY, formatE164 } from "@/lib/phone";
import {
  authIdentifierSchema,
  parseAuthIdentifier,
} from "@/lib/auth-identifier";

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

const forgotPasswordSchema = authIdentifierSchema;

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const PHONE_EXAMPLE = formatE164(
  DEFAULT_PHONE_COUNTRY.dialCode,
  DEFAULT_PHONE_COUNTRY.placeholder ?? "812345678",
  DEFAULT_PHONE_COUNTRY.iso
);
const IDENTIFIER_PLACEHOLDER = `owner@example.com or ${PHONE_EXAMPLE}`;

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      const parsed = parseAuthIdentifier(values.identifier);
      const payload =
        parsed.type === "email"
          ? { email: parsed.email }
          : { phone: parsed.phone };

      await authApi.forgotPassword(payload);

      feedback.success(
        "Reset link sent",
        "If an account exists for the provided details, a password reset link has been sent."
      );
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      if (status === 404) {
        feedback.success(
          "Reset link sent",
          "If an account exists for the provided details, a password reset link has been sent."
        );
        return;
      }

      if (status === 400) {
        feedback.error(
          "Could not send reset link",
          serverMessage ||
            "Please check your email or mobile number and try again.",
          "Try again later, or contact your administrator if the problem persists.",
          { code: ERROR_CODES.FORGOT_PASSWORD }
        );
        return;
      }

      feedback.fromError(
        error,
        "Could not start password reset",
        "Check your email or mobile number and try again.",
        ERROR_CODES.FORGOT_PASSWORD
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Forgot password?</CardTitle>
          <CardDescription className="text-sm">
            Enter your email or mobile number and we will send you a password
            reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or mobile number</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={IDENTIFIER_PLACEHOLDER}
                        className="touch-target"
                        autoComplete="username"
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
                Send reset link
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
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
