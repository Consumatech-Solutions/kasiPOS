"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useSettings } from "@/components/settings-provider";
import { useCustomers } from "@/hooks/use-customers";
import { useTransactions } from "@/hooks/use-transactions";
import { useClearCredit } from "@/hooks/use-clear-credit";
import type { Transaction } from "@/types";
import { isPendingCreditTransaction } from "@/lib/credit-transactions";
import {
  isSafeTransactionIdForLink,
  transactionIdString,
} from "@/lib/transaction-utils";
import { feedback } from "@/lib/feedback";
import { getErrorMessage } from "@/lib/feedback";
import type { ListFilter } from "@/components/transactions/transactions-toolbar";

function filterTransactions(
  rows: Transaction[],
  listFilter: ListFilter,
  searchTerm: string,
  getCustomerName: (customerId: string | undefined | null) => string
): Transaction[] {
  let result = rows;
  if (listFilter === "pending-credit") {
    result = result.filter((t) => isPendingCreditTransaction(t));
  }
  if (!searchTerm.trim()) return result;

  const searchLower = searchTerm.toLowerCase();
  const isIdSearch = /^[0-9a-f-]{0,36}$/i.test(searchTerm);
  return result.filter((transaction) => {
    const transactionId = transactionIdString(transaction.id).toLowerCase();
    const customerName = getCustomerName(transaction.customerId).toLowerCase();
    if (isIdSearch) return transactionId.includes(searchLower);
    return customerName.includes(searchLower);
  });
}

export function useTransactionsPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;
  const searchParams = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const highlightId =
    highlightParam && isSafeTransactionIdForLink(highlightParam.trim())
      ? highlightParam.trim()
      : null;
  const filterParam = searchParams.get("filter");

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>(
    filterParam === "pending-credit" ? "pending-credit" : "all"
  );
  const [clearTarget, setClearTarget] = useState<Transaction | null>(null);

  useEffect(() => {
    if (filterParam === "pending-credit") setListFilter("pending-credit");
  }, [filterParam]);

  const dateFilter = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;

  const isTransactionIdSearch =
    searchTerm && /^[0-9a-f-]{0,36}$/i.test(searchTerm);
  const backendSearch = isTransactionIdSearch ? searchTerm : undefined;

  const {
    transactions: allTransactions,
    loading,
    error,
    refresh,
  } = useTransactions({
    page: 1,
    limit: 100,
    date: dateFilter,
    search: backendSearch,
    storeIdForOffline: currentStore?.id ?? undefined,
  });

  const clearCredit = useClearCredit();
  const { customers: allCustomersList } = useCustomers({ initialLimit: 1000 });
  const customers = allCustomersList || [];

  const getCustomerName = useCallback(
    (customerId: string | undefined | null) => {
      if (!customerId) return "N/A";
      return (
        customers.find((c) => c.id === String(customerId))?.name || "Unknown"
      );
    },
    [customers]
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(
        allTransactions ?? [],
        listFilter,
        searchTerm,
        getCustomerName
      ),
    [allTransactions, listFilter, searchTerm, getCustomerName]
  );

  const pendingCreditCount = useMemo(
    () =>
      (allTransactions ?? []).filter((t) => isPendingCreditTransaction(t))
        .length,
    [allTransactions]
  );

  const clearFilters = useCallback(() => {
    setSelectedDate(undefined);
    setSearchTerm("");
    setListFilter("all");
  }, []);

  const handleConfirmClearCredit = useCallback(async () => {
    if (!clearTarget?.id) return;
    try {
      await clearCredit.mutateAsync(String(clearTarget.id));
      feedback.success(
        "Credit paid",
        "Transaction marked as paid. Customer balance updated."
      );
      setClearTarget(null);
      await refresh();
    } catch (err: unknown) {
      feedback.error(
        "Could not mark as paid",
        getErrorMessage(err),
        "Only pending credit sales can be cleared."
      );
    }
  }, [clearTarget, clearCredit, refresh]);

  return {
    loading,
    error,
    listFilter,
    setListFilter,
    pendingCreditCount,
    selectedDate,
    setSelectedDate,
    searchTerm,
    setSearchTerm,
    clearFilters,
    filteredTransactions,
    highlightId,
    clearTarget,
    setClearTarget,
    getCustomerName,
    handleConfirmClearCredit,
    clearCreditIsPending: clearCredit.isPending,
  };
}
