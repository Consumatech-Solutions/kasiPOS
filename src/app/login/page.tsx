"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
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
import { useSettings } from "@/components/settings-provider";
import { useI18n } from "@/components/i18n-provider";
import { useQueryClient } from "@tanstack/react-query";
import { runManualFullCloudSync } from "@/lib/cloud-data-pull";
import { offlineDetector } from "@/lib/offline-detector";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";

export default function LoginPage() {
  const { login } = useSettings();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const loginSchema = useMemo(
    () =>
      z.object({
        phone: z.string().min(10, { message: t("auth.phoneInvalid") }),
        password: z.string().min(1, { message: t("auth.passwordRequired") }),
      }),
    [t]
  );

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      const response = await authApi.login(values.phone, values.password);

      if (response.data && response.data.accessToken) {
        feedback.success(t("auth.loginSuccess"), t("auth.welcomeBackToast"));
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

      if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "Backend not reachable. Ensure backend is running (e.g. NEXT_PUBLIC_API_URL or http://localhost:9002)."
          );
        }
        feedback.error(
          t("auth.connectionError"),
          t("auth.cannotReachServer"),
          t("auth.ensureBackend"),
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
          ? t("auth.invalidCredentials")
          : t("auth.loginFailedRetry"));
      feedback.error(
        t("auth.loginFailed"),
        serverMessage,
        status === 401
          ? t("auth.checkCredentials")
          : t("auth.noAccount"),
        { code: ERROR_CODES.LOGIN }
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            {t("auth.welcomeBack")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("auth.signInDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.mobileNumber")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.mobilePlaceholder")}
                        className="touch-target"
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
                    <FormLabel>{t("auth.password")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        className="touch-target"
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
                {t("auth.signIn")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.firstTime")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/request-access">{t("auth.requestAccess")}</Link>
            </Button>
            {" · "}
            {t("auth.storeAdmin")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/set-password-store-admin">
                {t("auth.setPassword")}
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
