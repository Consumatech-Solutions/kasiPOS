"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
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

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

export default function RequestAccessPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const requestAccessSchema = useMemo(
    () =>
      z.object({
        phone: z.string().min(10, {
          message: t("auth.validation.phoneInvalid"),
        }),
      }),
    [t]
  );

  const form = useForm<z.infer<typeof requestAccessSchema>>({
    resolver: zodResolver(requestAccessSchema),
    defaultValues: { phone: "" },
  });

  const onSubmit = async (values: z.infer<typeof requestAccessSchema>) => {
    const phone = normalizePhone(values.phone);
    if (phone.length < 10) {
      feedback.error(
        t("auth.common.invalidNumberTitle"),
        t("auth.common.invalidNumberDesc"),
        undefined,
        { code: ERROR_CODES.REQUEST_ACCESS }
      );
      return;
    }
    try {
      await authApi.requestOtp(phone);
      feedback.success(
        t("auth.requestAccess.codeSentTitle"),
        t("auth.requestAccess.codeSentDesc", { phone })
      );
      router.push(`/verify-code?phone=${encodeURIComponent(phone)}`);
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("auth.requestAccess.failedTitle"),
        t("auth.requestAccess.failedHint"),
        ERROR_CODES.REQUEST_ACCESS
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.requestAccess.title")}</CardTitle>
          <CardDescription>{t("auth.requestAccess.description")}</CardDescription>
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
                        placeholder={t("auth.requestAccess.phonePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                {t("auth.requestAccess.sendCode")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.common.alreadyHaveAccount")}{" "}
            <Button variant="link" className="p-0" asChild>
              <Link href="/login">{t("auth.common.signInButton")}</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
