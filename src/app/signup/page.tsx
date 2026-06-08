"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { feedback, getErrorMessage } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import {
  backendUnreachableRecovery,
  isBackendConnectionError,
} from "@/lib/backend-connection";
import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";

type SignupFormValues = {
  email: string;
  name: string;
  storeName: string;
  password: string;
  phoneNumber: string;
};

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const signupSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .email({ message: t("auth.validation.emailInvalid") }),
        name: z.string().min(1, { message: t("auth.validation.nameRequired") }),
        storeName: z
          .string()
          .min(1, { message: t("auth.validation.storeNameRequired") }),
        password: z
          .string()
          .min(8, { message: t("auth.validation.passwordMin8") }),
        phoneNumber: z.string().min(10, {
          message: t("auth.validation.phoneInvalid"),
        }),
      }),
    [t]
  );

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      name: "",
      storeName: "",
      password: "",
      phoneNumber: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const phoneNumber = normalizePhone(values.phoneNumber);
    if (phoneNumber.length < 10) {
      feedback.error(
        t("auth.common.invalidNumberTitle"),
        t("auth.common.invalidNumberDesc"),
        undefined,
        { code: ERROR_CODES.SIGNUP }
      );
      return;
    }

    try {
      const response = await authApi.signup({
        email: values.email.trim(),
        name: values.name.trim(),
        storeName: values.storeName.trim(),
        password: values.password,
        phoneNumber,
      });

      const message =
        response.data?.message ?? t("auth.signup.codeSentDefault");
      feedback.success(t("auth.signup.checkEmailTitle"), message);
      router.push(
        `/signup/verify?email=${encodeURIComponent(values.email.trim())}`
      );
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: Record<string, unknown> };
      };
      const status = err?.response?.status;
      if (status === 409) {
        feedback.error(
          t("auth.signup.alreadyRegisteredTitle"),
          t("auth.signup.alreadyRegisteredDesc"),
          t("auth.signup.alreadyRegisteredHint"),
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      if (isBackendConnectionError(error)) {
        feedback.error(
          t("auth.signup.backendDownTitle"),
          t("auth.signup.backendDownDesc", { url: getConfiguredApiUrl() }),
          backendUnreachableRecovery(),
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      const message = getErrorMessage(error);
      if (status === 404 && /cannot post\s+\/auth\/signup/i.test(message)) {
        feedback.error(
          t("auth.signup.contactSupportTitle"),
          t("auth.signup.contactSupportDesc"),
          undefined,
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      feedback.fromError(
        error,
        t("auth.signup.failedTitle"),
        t("auth.signup.failedHint"),
        ERROR_CODES.SIGNUP
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            {t("auth.signup.title")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("auth.signup.description")}
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
                    <FormLabel>{t("auth.common.email")}</FormLabel>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.signup.nameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.signup.namePlaceholder")}
                        className="touch-target"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.signup.storeNameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.signup.storeNamePlaceholder")}
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.common.mobileNumber")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.signup.phonePlaceholder")}
                        className="touch-target"
                        autoComplete="tel"
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
                        autoComplete="new-password"
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
                {t("auth.signup.continue")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.common.alreadyHaveAccount")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/login">{t("auth.common.signIn")}</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
