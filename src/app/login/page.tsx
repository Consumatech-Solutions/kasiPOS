"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";

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
import { useSettings } from "@/components/settings-provider";
import { useQueryClient } from "@tanstack/react-query";
import { runManualFullCloudSync } from "@/lib/cloud-data-pull";
import { offlineDetector } from "@/lib/offline-detector";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import {
  backendUnreachableRecovery,
  isBackendConnectionError,
} from "@/lib/backend-connection";
import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";

const loginSchema = z
  .object({
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(1, { message: "Password is required." }),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim() ?? "";
    const phone = normalizePhone(data.phone ?? "");
    const hasEmail = email.length > 0;
    const hasPhone = phone.length >= 10;

    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your email or mobile number.",
        path: ["email"],
      });
      return;
    }

    if (hasEmail && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid email address.",
        path: ["email"],
      });
    }

    if (hasPhone && phone.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid mobile number (at least 10 digits).",
        path: ["phone"],
      });
    }
  });

type LoginFormValues = z.infer<typeof loginSchema>;

function buildLoginPayload(values: LoginFormValues) {
  const email = values.email?.trim();
  const phone = normalizePhone(values.phone ?? "");
  const payload: { password: string; email?: string; phone?: string } = {
    password: values.password,
  };
  if (email) payload.email = email;
  if (phone.length >= 10) payload.phone = phone;
  return payload;
}

export default function LoginPage() {
  const { login } = useSettings();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await authApi.login(buildLoginPayload(values));

      if (response.data && response.data.accessToken) {
        feedback.success("Login successful", "Welcome back!");
        await login({
          ...response.data.user,
          accessToken: response.data.accessToken,
        });

        try {
          const isOnline = await offlineDetector.forceCheck();
          if (isOnline) {
            await runManualFullCloudSync({
              queryClient,
              storeId: response.data.user.storeId,
            });
          }
        } catch (syncError) {
          console.error("Initial sync after login failed:", syncError);
        }
      }
    } catch (error: unknown) {
      const err = error as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: Record<string, unknown> };
      };
      const data = err?.response?.data;
      const status = err?.response?.status;

      if (process.env.NODE_ENV === "development" && err) {
        console.warn("[Login] Error details:", {
          status,
          data,
          code: err.code,
          message: err.message,
        });
      }

      if (isBackendConnectionError(err)) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[Login] Backend not reachable at ${getConfiguredApiUrl()}`
          );
        }
        feedback.error(
          "Backend not running",
          `Cannot reach the API at ${getConfiguredApiUrl()}.`,
          backendUnreachableRecovery(),
          { code: ERROR_CODES.LOGIN }
        );
        return;
      }

      const serverMessage =
        (typeof data?.message === "string" && data.message) ||
        (typeof (data as { error?: string })?.error === "string" &&
          (data as { error: string }).error) ||
        (typeof (data as { msg?: string })?.msg === "string" &&
          (data as { msg: string }).msg) ||
        (status === 401
          ? "Invalid email/phone or password."
          : "Login failed. Please try again.");
      feedback.error(
        "Login failed",
        serverMessage,
        status === 401
          ? "Check your email or phone and password."
          : "Try again or create an account if you are new.",
        { code: ERROR_CODES.LOGIN }
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Welcome Back!</CardTitle>
          <CardDescription className="text-sm">
            Sign in with your email or mobile number and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="owner@example.com"
                        className="touch-target"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 0812345678"
                        className="touch-target"
                        autoComplete="tel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Enter at least one of email or mobile number.
              </p>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        className="touch-target"
                        autoComplete="current-password"
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
                Sign In
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/signup">Create an account</Link>
            </Button>
            {" · "}
            Invited by admin?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/request-access">Request access</Link>
            </Button>
            {" · "}
            Store admin?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/set-password-store-admin">Set your password</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
