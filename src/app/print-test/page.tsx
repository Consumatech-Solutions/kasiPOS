"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Printer, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { buildTestPrintPayload } from "@/lib/device-service";
import { printViaRawBt, RAWBT_PLAY_STORE_URL } from "@/lib/rawbt-print";
import { isAndroid } from "@/lib/platform";

export default function PrintTestPage() {
  const { t } = useTranslation();
  const [isPrinting, setIsPrinting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">(
    "success"
  );

  const onAndroid = isAndroid();

  const runPrint = async () => {
    setIsPrinting(true);
    setFeedback(null);

    try {
      await printViaRawBt(buildTestPrintPayload());
      setFeedbackTone("success");
      setFeedback(t("printTest.successFeedback"));
    } catch (error: unknown) {
      setFeedbackTone("error");
      const err = error as { message?: string };
      setFeedback(err?.message || t("printTest.failedFeedback"));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("printTest.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("printTest.description")}
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-3 text-sm">
          <p className="font-medium">{t("printTest.checklistTitle")}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>
              {t("printTest.installRawBt")}{" "}
              <a
                href={RAWBT_PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                RawBT
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>{t("printTest.pairPrinter")}</li>
            <li>{t("printTest.openOnAndroid")}</li>
            <li>{t("printTest.tapSend")}</li>
          </ol>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>
              Platform:{" "}
              {onAndroid
                ? t("printTest.platformAndroid")
                : t("printTest.platformNotAndroid")}
            </p>
            <p>{t("printTest.method")}</p>
          </div>

          <Button
            type="button"
            className="w-full min-h-[44px]"
            onClick={runPrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("printTest.sending")}
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                {t("printTest.sendButton")}
              </>
            )}
          </Button>

          {feedback ? (
            <p
              className={`text-sm ${
                feedbackTone === "success" ? "text-green-700" : "text-red-600"
              }`}
            >
              {feedback}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("printTest.afterSetup")}{" "}
          <Link href="/settings" className="text-primary underline">
            {t("printTest.settingsLink")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
