"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsApi } from "@/lib/api/transactions";
import { transactionKeys } from "@/hooks/use-transactions";
import { notificationKeys } from "@/hooks/use-backend-notifications";
import { updateTransactionInDexie } from "@/lib/entity-cache";
import { feedback } from "@/lib/feedback";
import { getErrorMessage } from "@/lib/feedback";
import type { Transaction } from "@/types";

export function useClearCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionsApi.clearCredit({ id }),
    onSuccess: async (response) => {
      const updated = response.data;
      if (updated) {
        await updateTransactionInDexie(updated as Transaction);
      }
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      feedback.success(
        "Credit marked as paid",
        "The transaction status has been updated."
      );
    },
    onError: (error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        feedback.error(
          "Could not mark credit as paid",
          "Unauthorized",
          "Your session has expired. Please sign in again."
        );
        return;
      }
      feedback.error(
        "Could not mark credit as paid",
        getErrorMessage(error),
        "Check the transaction is still pending credit."
      );
    },
  });
}
