"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsApi } from "@/lib/api/transactions";
import { updateTransactionInDexie } from "@/lib/entity-cache";
import { transactionKeys } from "@/hooks/use-transactions";
import { customerKeys } from "@/hooks/use-customers";
import { notificationKeys } from "@/hooks/use-backend-notifications";
import type { Transaction } from "@/types";
import { checkOfflineStatus } from "@/lib/offline-detector";

export function useClearCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      if (await checkOfflineStatus()) {
        throw new Error(
          "You must be online to mark credit as paid. Check your connection and try again."
        );
      }
      const res = await transactionsApi.clearCredit({ id: transactionId });
      return res.data;
    },
    onSuccess: async (updated: Transaction) => {
      if (updated?.id) {
        await updateTransactionInDexie(updated);
      }
      await queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(),
      });
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
