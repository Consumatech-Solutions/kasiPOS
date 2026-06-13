"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { normalizePhone, DEFAULT_PHONE_COUNTRY, formatE164 } from "@/lib/phone";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_INPUT_REGEX = /^[\d\s\-+()]+$/;

type IdentifierType = "email" | "phone";

function detectIdentifierType(value: string): IdentifierType | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@") || EMAIL_REGEX.test(trimmed)) return "email";
  if (PHONE_INPUT_REGEX.test(trimmed)) return "phone";
  return null;
}

const loginSchema = z
  .object({
    identifier: z
      .string()
      .min(1, { message: "Enter your email or mobile number." }),
    password: z.string().min(1, { message: "Password is required." }),
  })
  .superRefine((data, ctx) => {
    const trimmed = data.identifier.trim();
    const type = detectIdentifierType(trimmed);

    if (!type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address or mobile number.",
        path: ["identifier"],
      });
      return;
    }

    if (type === "email" && !z.string().email().safeParse(trimmed).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid email address.",
        path: ["identifier"],
      });
    }

    if (type === "phone" && normalizePhone(trimmed).length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid mobile number (at least 10 digits).",
        path: ["identifier"],
      });
    }
  });

type LoginFormValues = z.infer<typeof loginSchema>;

function buildLoginPayload(values: LoginFormValues) {
  const trimmed = values.identifier.trim();
  const type = detectIdentifierType(trimmed);
  const payload: { password: string; email?: string; phone?: string } = {
    password: values.password,
  };

  if (type === "email") {
    payload.email = trimmed;
  } else if (type === "phone") {
    payload.phone = normalizePhone(trimmed);
  }

  return payload;
}

const LOGIN_PHONE_EXAMPLE = formatE164(
  DEFAULT_PHONE_COUNTRY.dialCode,
  DEFAULT_PHONE_COUNTRY.placeholder ?? "812345678",
  DEFAULT_PHONE_COUNTRY.iso
);
const LOGIN_IDENTIFIER_PLACEHOLDER = `owner@example.com or ${LOGIN_PHONE_EXAMPLE}`;

export default function LoginPage() {
  const { login } = useSettings();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
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
          "Login Failed, please try again with a different email or phone number"
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
            Sign in with your email or mobile number (digits only, e.g.{" "}
            {LOGIN_PHONE_EXAMPLE}) and password
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
                        placeholder={LOGIN_IDENTIFIER_PLACEHOLDER}
                        className="touch-target"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
