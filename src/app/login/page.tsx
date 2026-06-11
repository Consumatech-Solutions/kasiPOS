"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useTranslation } from "react-i18next";
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
import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";
import { resolveLoginErrorFeedback } from "@/lib/login-error";

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

type LoginFormValues = {
  identifier: string;
  password: string;
};

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useSettings();
  const queryClient = useQueryClient();

  const loginSchema = useMemo(
    () =>
      z
        .object({
          identifier: z
            .string()
            .min(1, { message: t("auth.validation.identifierRequired") }),
          password: z
            .string()
            .min(1, { message: t("auth.validation.passwordRequired") }),
        })
        .superRefine((data, ctx) => {
          const trimmed = data.identifier.trim();
          const type = detectIdentifierType(trimmed);

          if (!type) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("auth.validation.identifierInvalid"),
              path: ["identifier"],
            });
            return;
          }

          if (
            type === "email" &&
            !z.string().email().safeParse(trimmed).success
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("auth.validation.emailInvalid"),
              path: ["identifier"],
            });
          }

          if (type === "phone" && normalizePhone(trimmed).length < 10) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("auth.validation.phoneInvalid"),
              path: ["identifier"],
            });
          }
        }),
    [t]
  );

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const runPostLoginSync = async (storeId: string) => {
    try {
      const isOnline = await offlineDetector.forceCheck();
      if (isOnline) {
        await runManualFullCloudSync({ queryClient, storeId });
      }
    } catch (syncError) {
      console.error("Initial sync after login failed:", syncError);
    }
  };

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await authApi.login(buildLoginPayload(values));
      const token = response.data?.accessToken;
      const user = response.data?.user;
      if (!token || !user) return;

      feedback.success(
        t("auth.login.successTitle"),
        t("auth.login.successDesc")
      );
      await login({ ...user, accessToken: token });
      if (user.storeId) {
        await runPostLoginSync(user.storeId);
      }
    } catch (error: unknown) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Login] Error details:", error);
        console.warn(
          `[Login] Backend URL: ${getConfiguredApiUrl()}`
        );
      }
      const loginError = resolveLoginErrorFeedback(error, t);
      feedback.error(
        loginError.title,
        loginError.message,
        loginError.hint,
        loginError.code ? { code: loginError.code } : undefined
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            {t("auth.login.title")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("auth.login.description")}
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
                    <FormLabel>{t("auth.login.identifierLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("auth.login.identifierPlaceholder")}
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
                    <FormLabel>{t("auth.common.password")}</FormLabel>
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
                {t("auth.common.signInButton")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.common.newHere")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/signup">{t("auth.common.createAccount")}</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
