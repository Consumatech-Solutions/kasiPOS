"use client";

import { Suspense, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { authApi } from "@/lib/api";

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
import { useSettings } from "@/components/settings-provider";

function SetPasswordContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams ? searchParams.get("phone") : null;
  const { login } = useSettings();

  const setPasswordSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, { message: t("auth.validation.passwordMin8") }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("auth.validation.passwordsMismatch"),
          path: ["confirmPassword"],
        }),
    [t]
  );

  const form = useForm<z.infer<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: z.infer<typeof setPasswordSchema>) => {
    if (!phone) {
      feedback.error(
        t("auth.setPassword.noPhoneTitle"),
        t("auth.setPassword.noPhoneDesc"),
        t("auth.setPassword.noPhoneHint"),
        { code: ERROR_CODES.SET_PASSWORD }
      );
      router.push("/request-access");
      return;
    }

    const tempToken =
      typeof window !== "undefined"
        ? localStorage.getItem("kasi-pos-temp-token")
        : null;
    if (!tempToken) {
      feedback.error(
        t("auth.setPassword.sessionExpiredTitle"),
        t("auth.setPassword.sessionExpiredDesc"),
        t("auth.setPassword.sessionExpiredHint"),
        { code: ERROR_CODES.SET_PASSWORD }
      );
      router.push("/request-access");
      return;
    }

    try {
      const response = await authApi.setPassword(values.password, tempToken);

      if (response.data && response.data.accessToken) {
        feedback.success(
          t("auth.setPassword.successTitle"),
          t("auth.setPassword.successDesc")
        );
        if (typeof window !== "undefined")
          localStorage.removeItem("kasi-pos-temp-token");
        await login({
          ...response.data.user,
          accessToken: response.data.accessToken,
        });
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("auth.setPassword.failedTitle"),
        t("auth.setPassword.failedHint"),
        ERROR_CODES.SET_PASSWORD
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.setPassword.title")}</CardTitle>
          <CardDescription>{t("auth.setPassword.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.setPassword.newPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
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
                    <FormLabel>{t("auth.setPassword.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                {t("auth.setPassword.submit")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          {t("auth.common.loading")}
        </div>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
