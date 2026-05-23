"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTestPrintPayload } from "@/lib/device-service";
import { printViaRawBt, RAWBT_PLAY_STORE_URL } from "@/lib/rawbt-print";
import { isAndroid } from "@/lib/platform";

export default function PrintTestPage() {
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
      setFeedback(
        "RawBT opened. Confirm a test receipt prints on your thermal printer."
      );
    } catch (error: any) {
      setFeedbackTone("error");
      setFeedback(error?.message || "Print failed.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">RawBT print test</h1>
          <p className="text-sm text-muted-foreground">
            Public page for testing RawBT on Android. No login required.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-3 text-sm">
          <p className="font-medium">Setup checklist</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>
              Install{" "}
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
            <li>Open RawBT and pair your thermal printer</li>
            <li>Open this page on the same Android device in Chrome</li>
            <li>Tap Send test print below</li>
          </ol>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>Platform: {onAndroid ? "Android detected" : "Not Android"}</p>
            <p>Method: RawBT intent (rawbt:base64)</p>
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
                Sending test print...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Send test print
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
          After setup works here, configure the receipt printer in{" "}
          <Link href="/settings" className="text-primary underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
