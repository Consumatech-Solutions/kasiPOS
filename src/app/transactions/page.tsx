"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/settings-provider";
import { useCustomers } from "@/hooks/use-customers";
import { useTransactions } from "@/hooks/use-transactions";
import { useClearCredit } from "@/hooks/use-clear-credit";
import type { Transaction } from "@/types";
import {
  creditDueDateLabel,
  isPendingCreditTransaction,
  transactionDisplayStatus,
} from "@/lib/credit-transactions";
import {
  formatTransactionIdShort,
  isSafeTransactionIdForLink,
  parseTransactionDate,
  transactionIdString,
} from "@/lib/transaction-utils";

type ListFilter = "all" | "pending-credit";

function TransactionsPageContent() {
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
      if (!customers.length || !customerId) return "N/A";
      return (
        customers.find((c) => c.id === String(customerId))?.name || "Unknown"
      );
    },
    [customers]
  );

  const filteredTransactions = useMemo(() => {
    let rows = allTransactions ?? [];
    if (listFilter === "pending-credit") {
      rows = rows.filter((t) => isPendingCreditTransaction(t));
    }
    if (!searchTerm.trim()) return rows;

    const searchLower = searchTerm.toLowerCase();
    const idSearch = /^[0-9a-f-]{0,36}$/i.test(searchTerm);
    return rows.filter((transaction) => {
      const transactionId = transactionIdString(transaction.id).toLowerCase();
      const customerName = getCustomerName(
        transaction.customerId
      ).toLowerCase();
      if (idSearch) return transactionId.includes(searchLower);
      return customerName.includes(searchLower);
    });
  }, [allTransactions, listFilter, searchTerm, getCustomerName]);

  const pendingCreditCount = useMemo(
    () =>
      (allTransactions ?? []).filter((t) => isPendingCreditTransaction(t))
        .length,
    [allTransactions]
  );

  const handleConfirmClearCredit = async () => {
    const id = transactionIdString(clearTarget?.id);
    if (!id) return;
    await clearCredit.mutateAsync(id);
    setClearTarget(null);
  };

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">
          Transaction History
        </CardTitle>
        <CardDescription className="text-sm">
          View sales, pending credit, and mark credit as paid when customers
          settle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={listFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setListFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              variant={listFilter === "pending-credit" ? "default" : "outline"}
              size="sm"
              onClick={() => setListFilter("pending-credit")}
            >
              Pending credit
              {pendingCreditCount > 0 ? ` (${pendingCreditCount})` : ""}
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by Order # or Customer"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {(selectedDate || searchTerm) && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="min-h-[44px] touch-target w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" /> Clear Filters
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-18rem)]">
          {loading ? (
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              Loading transactions...
            </div>
          ) : error ? (
            <div className="text-center h-24 flex items-center justify-center text-destructive">
              {error}
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue={highlightId ? `item-${highlightId}` : undefined}
            >
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index) => {
                  const txId = transactionIdString(transaction.id);
                  const transactionDate = parseTransactionDate(transaction);
                  const isPendingCredit =
                    isPendingCreditTransaction(transaction);
                  const isHighlighted =
                    highlightId != null &&
                    highlightId !== "" &&
                    txId === highlightId;
                  const dueLabel = creditDueDateLabel(
                    transaction.creditDueAt ??
                      transaction.creditDetails?.dueAt ??
                      null
                  );
                  const status = transactionDisplayStatus(transaction);

                  return (
                    <AccordionItem
                      value={`item-${txId || index}`}
                      key={txId || `tx-${index}`}
                      className={cn(
                        isHighlighted && "rounded-md ring-2 ring-primary/40"
                      )}
                    >
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4 gap-2">
                          <div className="text-left min-w-0">
                            <p className="font-medium">
                              Transaction #
                              {formatTransactionIdShort(transaction.id)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(transactionDate, "PPP p")}
                            </p>
                            {dueLabel && isPendingCredit && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Due {dueLabel}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-lg">
                              R{Number(transaction.total).toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getCustomerName(transaction.customerId)}
                            </p>
                            <div className="flex flex-wrap gap-1 justify-end mt-1">
                              <Badge variant="secondary">
                                {transaction.paymentMethod}
                              </Badge>
                              <Badge
                                variant={
                                  status === "paid"
                                    ? "default"
                                    : status === "pending"
                                      ? "outline"
                                      : "destructive"
                                }
                              >
                                {status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 pl-2">
                          {transaction.items?.map((item) => (
                            <li
                              key={`${txId}-${item.productId}`}
                              className="flex justify-between items-center text-sm"
                            >
                              <div>
                                <span className="font-medium">
                                  {item.productName}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  ({item.quantity} x R
                                  {Number(item.unitPrice).toFixed(2)})
                                </span>
                              </div>
                              <span className="font-medium">
                                R{Number(item.totalPrice).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {isPendingCredit && txId && (
                          <div className="mt-4 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => setClearTarget(transaction)}
                            >
                              Mark credit as paid
                            </Button>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              ) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                  {listFilter === "pending-credit"
                    ? "No pending credit sales."
                    : "No transactions found for the selected filters."}
                </div>
              )}
            </Accordion>
          )}
        </ScrollArea>
      </CardContent>

      <AlertDialog
        open={clearTarget != null}
        onOpenChange={(open) => !open && setClearTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark credit as paid?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that{" "}
              <span className="font-medium text-foreground">
                {getCustomerName(clearTarget?.customerId)}
              </span>{" "}
              has paid R{Number(clearTarget?.total ?? 0).toFixed(2)} for this
              sale. This cannot be undone from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearCredit.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={clearCredit.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmClearCredit();
              }}
            >
              {clearCredit.isPending ? "Saving..." : "Confirm payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              Loading transactions...
            </div>
          </CardContent>
        </Card>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
