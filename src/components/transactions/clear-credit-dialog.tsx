"use client";

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
import { Loader2 } from "lucide-react";
import type { Transaction } from "@/types";

export type ClearCreditDialogProps = {
  readonly clearTarget: Transaction | null;
  readonly customerName: string;
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

export function ClearCreditDialog({
  clearTarget,
  customerName,
  isPending,
  onOpenChange,
  onConfirm,
}: ClearCreditDialogProps) {
  return (
    <AlertDialog open={clearTarget != null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark credit as paid?</AlertDialogTitle>
          <AlertDialogDescription>
            This records payment for{" "}
            <strong>R{Number(clearTarget?.total ?? 0).toFixed(2)}</strong> from{" "}
            {customerName}. The customer&apos;s outstanding balance will be
            reduced and payment reminders will stop.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Confirm payment"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
