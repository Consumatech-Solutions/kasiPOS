"use client";

import { Suspense, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
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

function VerifySignupContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams?.get("email")?.trim() ?? "";
  const { login, setSetting } = useSettings();
  const queryClient = useQueryClient();
  const isDev = process.env.NODE_ENV === "development";

  const verifySignupSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, { message: t("auth.validation.code6Digits") })
          .regex(/^\d{6}$/, { message: t("auth.validation.code6DigitsShort") }),
      }),
    [t]
  );

  const form = useForm<z.infer<typeof verifySignupSchema>>({
    resolver: zodResolver(verifySignupSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: z.infer<typeof verifySignupSchema>) => {
    if (!email) {
      feedback.error(
        t("auth.signupVerify.noEmailTitle"),
        t("auth.signupVerify.noEmailDesc"),
        t("auth.signupVerify.noEmailHint"),
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
          t("auth.signupVerify.noEmailTitle"),
          t("auth.signupVerify.invalidResponse"),
          undefined,
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }

      feedback.success(
        t("auth.signupVerify.successTitle"),
        t("auth.signupVerify.successDesc")
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
          t("auth.signupVerify.invalidCodeTitle"),
          t("auth.signupVerify.invalidCodeDesc"),
          isDev ? t("auth.signupVerify.devCodeHint") : undefined,
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }
      if (status === 409) {
        feedback.error(
          t("auth.signup.alreadyRegisteredTitle"),
          t("auth.signup.alreadyRegisteredDesc"),
          t("auth.signupVerify.trySignIn"),
          { code: ERROR_CODES.SIGNUP_VERIFY }
        );
        return;
      }
      feedback.fromError(
        error,
        t("auth.signupVerify.failedTitle"),
        t("auth.signupVerify.failedHint"),
        ERROR_CODES.SIGNUP_VERIFY
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            {t("auth.signupVerify.title")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("auth.signupVerify.description")}
            {email || t("auth.signupVerify.descriptionYourEmail")}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDev && (
            <p className="mb-4 text-center text-xs text-muted-foreground">
              {t("auth.signupVerify.devHint")} <strong>123456</strong>.
            </p>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.signupVerify.codeLabel")}</FormLabel>
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
                {t("auth.signupVerify.submit")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.signupVerify.wrongEmail")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/signup">{t("auth.signupVerify.startOver")}</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifySignupPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          {t("auth.common.loading")}
        </div>
      }
    >
      <VerifySignupContent />
    </Suspense>
  );
}
