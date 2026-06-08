"use client";

import { Suspense, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

function VerifyCodeContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams ? searchParams.get("phone") : null;

  const verifyCodeSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, { message: t("auth.validation.code6DigitsShort") }),
      }),
    [t]
  );

  const form = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: z.infer<typeof verifyCodeSchema>) => {
    if (!phone) {
      feedback.error(
        t("auth.verifyCode.noPhoneTitle"),
        t("auth.verifyCode.noPhoneDesc"),
        t("auth.verifyCode.noPhoneHint"),
        { code: ERROR_CODES.VERIFY }
      );
      router.push("/request-access");
      return;
    }

    try {
      const response = await authApi.verifyOtp(phone, values.code);

      if (response.data) {
        feedback.success(
          t("auth.verifyCode.successTitle"),
          t("auth.verifyCode.successDesc")
        );

        const { tempToken, hasPassword, user } = response.data;

        if (tempToken) {
          localStorage.setItem("kasi-pos-temp-token", tempToken);
        }

        if (hasPassword && user) {
          if (hasPassword) {
            router.push("/login");
          } else {
            router.push(`/set-password?phone=${encodeURIComponent(phone)}`);
          }
        } else {
          router.push(`/set-password?phone=${encodeURIComponent(phone)}`);
        }
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("auth.verifyCode.failedTitle"),
        t("auth.verifyCode.failedHint"),
        ERROR_CODES.VERIFY
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.verifyCode.title")}</CardTitle>
          <CardDescription>
            {t("auth.verifyCode.description")}
            {phone
              ? t("auth.verifyCode.descriptionEnding", {
                  suffix: phone.slice(-4),
                })
              : "."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.verifyCode.codeLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder="123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                {t("auth.verifyCode.submit")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.verifyCode.noCode")}{" "}
            <Button variant="link" className="p-0" asChild>
              <Link href="/request-access">{t("auth.verifyCode.resend")}</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyCodePage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          {t("auth.common.loading")}
        </div>
      }
    >
      <VerifyCodeContent />
    </Suspense>
  );
}
