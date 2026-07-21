"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ForgotPasswordSentContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const channel = searchParams?.get("channel");
  const isSms = channel === "sms";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle className="text-lg sm:text-xl">
            {t("forgotPassword.sent.title")}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSms
              ? t("forgotPassword.sent.descriptionSms")
              : t("forgotPassword.sent.descriptionEmail")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {isSms
              ? t("forgotPassword.sent.hintSms")
              : t("forgotPassword.sent.hintEmail")}
          </p>
          <Button asChild className="w-full min-h-[44px] touch-target">
            <Link href="/login">{t("forgotPassword.sent.backToSignIn")}</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("forgotPassword.sent.wrongDetails")}{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/forgot-password">
                {t("forgotPassword.sent.tryAgain")}
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ForgotPasswordSentFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      {t("forgotPassword.sent.loading")}
    </div>
  );
}

export default function ForgotPasswordSentPage() {
  return (
    <Suspense fallback={<ForgotPasswordSentFallback />}>
      <ForgotPasswordSentContent />
    </Suspense>
  );
}
