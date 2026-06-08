"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
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
import Link from "next/link";

type FormValues = {
  phone: string;
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function SetPasswordStoreAdminPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useSettings();

  const setPasswordStoreAdminSchema = useMemo(
    () =>
      z
        .object({
          phone: z
            .string()
            .min(10, { message: t("auth.validation.phoneValid") }),
          temporaryPassword: z.string().min(1, {
            message: t("auth.validation.tempPasswordRequired"),
          }),
          newPassword: z
            .string()
            .min(8, { message: t("auth.validation.newPasswordMin8") }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("auth.validation.passwordsMismatch"),
          path: ["confirmPassword"],
        }),
    [t]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(setPasswordStoreAdminSchema),
    defaultValues: {
      phone: "",
      temporaryPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await authApi.setPasswordStoreAdmin({
        phone: values.phone,
        temporaryPassword: values.temporaryPassword,
        newPassword: values.newPassword,
      });

      if (response.data?.accessToken && response.data?.user) {
        feedback.success(
          t("auth.setPasswordStoreAdmin.successTitle"),
          t("auth.setPasswordStoreAdmin.successDesc")
        );
        await login({
          ...response.data.user,
          accessToken: response.data.accessToken,
        });
        router.push("/");
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = err?.response?.status;
      const message = err?.response?.data?.message;

      if (status === 401) {
        feedback.error(
          t("auth.setPasswordStoreAdmin.invalidTempTitle"),
          message || t("auth.setPasswordStoreAdmin.invalidTempDefault"),
          t("auth.setPasswordStoreAdmin.invalidTempHint"),
          { code: ERROR_CODES.SET_PASSWORD_STORE_ADMIN }
        );
        return;
      }
      if (status === 404) {
        feedback.error(
          t("auth.setPasswordStoreAdmin.userNotFoundTitle"),
          message || t("auth.setPasswordStoreAdmin.userNotFoundDefault"),
          t("auth.setPasswordStoreAdmin.userNotFoundHint"),
          { code: ERROR_CODES.SET_PASSWORD_STORE_ADMIN }
        );
        return;
      }
      feedback.fromError(
        error,
        t("auth.setPasswordStoreAdmin.failedTitle"),
        t("auth.setPasswordStoreAdmin.failedHint"),
        ERROR_CODES.SET_PASSWORD_STORE_ADMIN
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.setPasswordStoreAdmin.title")}</CardTitle>
          <CardDescription>
            {t("auth.setPasswordStoreAdmin.description")}
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
                    <FormLabel>{t("auth.common.mobileNumber")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.signup.phonePlaceholder")}
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
                name="temporaryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.setPasswordStoreAdmin.tempPasswordLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        className="touch-target"
                        placeholder={t(
                          "auth.setPasswordStoreAdmin.tempPasswordPlaceholder"
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.setPasswordStoreAdmin.newPassword")}
                    </FormLabel>
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.setPasswordStoreAdmin.confirmPassword")}
                    </FormLabel>
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
                {t("auth.setPasswordStoreAdmin.submit")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/login">
                {t("auth.setPasswordStoreAdmin.backToSignIn")}
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
