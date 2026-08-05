"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import { canClearCreditTransaction } from "@/lib/clear-credit";
import { getTransactionApiId } from "@/lib/transaction-id";
import { useEffectiveOnline } from "@/hooks/use-effective-online";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import type { Transaction, UserRole } from "@/types";

interface ClearCreditButtonProps {
  transaction: Transaction;
  role: UserRole | undefined;
  customerName: string;
  onClearCredit: (transactionId: string) => Promise<Transaction>;
  isClearing?: boolean;
  className?: string;
}

export function ClearCreditButton({
  transaction,
  role,
  customerName,
  onClearCredit,
  isClearing = false,
  className,
}: ClearCreditButtonProps) {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const { effectiveOnline } = useEffectiveOnline();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!canClearCreditTransaction(role, transaction)) {
    return null;
  }

  const transactionId = getTransactionApiId(transaction);
  const busy = submitting || isClearing;

  const handleConfirm = async () => {
    if (busy) return;
    if (!transactionId) {
      feedback.error(
        t("transactions.clearCredit.errorTitle"),
        t("transactions.clearCredit.invalidIdDesc"),
        undefined,
        { code: ERROR_CODES.APP_UPDATE }
      );
      return;
    }
    if (!effectiveOnline) {
      feedback.error(
        t("transactions.clearCredit.offlineTitle"),
        t("transactions.clearCredit.offlineDesc"),
        undefined
      );
      return;
    }

    setSubmitting(true);
    try {
      await onClearCredit(transactionId);
      feedback.success(
        t("transactions.clearCredit.successTitle"),
        t("transactions.clearCredit.successDesc")
      );
      setConfirmOpen(false);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message || err?.message;

      if (status === 401 || status === 403) {
        feedback.error(
          t("transactions.clearCredit.unauthorizedTitle"),
          serverMessage || t("transactions.clearCredit.unauthorizedDesc"),
          undefined,
          { code: ERROR_CODES.APP_UPDATE }
        );
      } else if (status === 404) {
        feedback.error(
          t("transactions.clearCredit.notFoundTitle"),
          serverMessage || t("transactions.clearCredit.notFoundDesc"),
          undefined,
          { code: ERROR_CODES.APP_UPDATE }
        );
      } else {
        feedback.error(
          t("transactions.clearCredit.errorTitle"),
          serverMessage || t("transactions.clearCredit.errorDesc"),
          undefined,
          { code: ERROR_CODES.APP_UPDATE }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className={className ?? "min-h-[44px] touch-target"}
        disabled={busy || !effectiveOnline}
        onClick={() => setConfirmOpen(true)}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("transactions.clearCredit.processing")}
          </>
        ) : (
          t("transactions.clearCredit.action")
        )}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("transactions.clearCredit.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t("transactions.clearCredit.confirmDesc")}
              </span>
              <span className="block text-foreground">
                {t("transactions.clearCredit.confirmMeta", {
                  customer: customerName,
                  amount: formatMoney(Number(transaction.total ?? 0)),
                })}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("transactions.clearCredit.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("transactions.clearCredit.processing")}
                </>
              ) : (
                t("transactions.clearCredit.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
