"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  canMarkCreditAsPaid,
  isPendingCreditTransaction,
} from "@/lib/credit-transactions";
import {
  resolveTransactionServerId,
  transactionIdString,
} from "@/lib/transaction-utils";
import type { Transaction } from "@/types";

function transactionPayableKey(transaction: Transaction): string {
  return (
    transactionIdString(transaction.id) ||
    (transaction.idempotencyKey?.trim() ?? "")
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

function pendingCreditDependencyKey(transactions: Transaction[]): string {
  return transactions
    .filter(isPendingCreditTransaction)
    .map(
      (tx) =>
        `${transactionPayableKey(tx)}|${tx.status ?? ""}|${Number(tx.total)}`
    )
    .sort()
    .join(",");
}

/** Pending credit rows that can call clear-credit (server UUID or syncIdMapping). */
export function usePayableCreditTransactionIds(transactions: Transaction[]) {
  const [payableKeys, setPayableKeys] = useState<Set<string>>(() => new Set());

  const pendingCreditKey = useMemo(
    () => pendingCreditDependencyKey(transactions),
    [transactions]
  );

  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  useEffect(() => {
    let cancelled = false;
    const list = transactionsRef.current;
    void (async () => {
      const next = new Set<string>();
      for (const tx of list) {
        if (!isPendingCreditTransaction(tx)) continue;
        const key = transactionPayableKey(tx);
        if (!key) continue;
        if (canMarkCreditAsPaid(tx)) {
          next.add(key);
          continue;
        }
        const serverId = await resolveTransactionServerId(tx);
        if (serverId) next.add(key);
      }
      if (!cancelled) {
        setPayableKeys((prev) => (setsEqual(prev, next) ? prev : next));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingCreditKey]);

  const isPayable = useCallback(
    (transaction: Transaction) => {
      const key = transactionPayableKey(transaction);
      return key !== "" && payableKeys.has(key);
    },
    [payableKeys]
  );

  return { isPayable, payableKeys };
}
