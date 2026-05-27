"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
import {
  Calendar as CalendarIcon,
  Search,
  X,
  Loader2,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/settings-provider";
import { useCustomers } from "@/hooks/use-customers";
import { useTransactions } from "@/hooks/use-transactions";
import { useClearCredit } from "@/hooks/use-clear-credit";
import { useSearchParams } from "next/navigation";
import type { Transaction } from "@/types";
import {
  getCreditDueAt,
  getTransactionStatus,
  isPendingCreditTransaction,
} from "@/lib/credit-transactions";
import {
  formatCreditDueLabel,
  formatTransactionIdShort,
  isSafeTransactionIdForLink,
  parseTransactionDate,
  transactionIdString,
} from "@/lib/transaction-utils";
import { feedback } from "@/lib/feedback";
import { getErrorMessage } from "@/lib/feedback";

type ListFilter = "all" | "pending-credit";

function statusBadgeVariant(
  status: ReturnType<typeof getTransactionStatus>
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending") return "destructive";
  if (status === "failed") return "outline";
  return "secondary";
}

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

  const getCustomerName = (customerId: string | undefined | null) => {
    if (!customers || !customerId) return "N/A";
    return (
      customers.find((c) => c.id === String(customerId))?.name || "Unknown"
    );
  };

  const filteredTransactions = useMemo(() => {
    let rows = allTransactions ?? [];
    if (listFilter === "pending-credit") {
      rows = rows.filter((t) => isPendingCreditTransaction(t));
    }
    if (!searchTerm) return rows;
    const searchLower = searchTerm.toLowerCase();
    const isIdSearch = /^[0-9a-f-]{0,36}$/i.test(searchTerm);
    return rows.filter((transaction) => {
      const transactionId = transactionIdString(transaction.id).toLowerCase();
      const customerName = getCustomerName(
        transaction.customerId
      ).toLowerCase();
      if (isIdSearch) return transactionId.includes(searchLower);
      return customerName.includes(searchLower);
    });
  }, [allTransactions, listFilter, searchTerm, customers]);

  const pendingCreditCount = useMemo(
    () =>
      (allTransactions ?? []).filter((t) => isPendingCreditTransaction(t))
        .length,
    [allTransactions]
  );

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm("");
    setListFilter("all");
  };

  const handleConfirmClearCredit = async () => {
    if (!clearTarget?.id) return;
    try {
      await clearCredit.mutateAsync(String(clearTarget.id));
      feedback.success(
        "Credit paid",
        `Transaction marked as paid. Customer balance updated.`
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
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={listFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setListFilter("all")}
            >
              All transactions
            </Button>
            <Button
              variant={listFilter === "pending-credit" ? "default" : "outline"}
              size="sm"
              onClick={() => setListFilter("pending-credit")}
            >
              Pending credit
              {pendingCreditCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCreditCount}
                </Badge>
              )}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP")
                  ) : (
                    <span>Filter by date</span>
                  )}
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

            {(selectedDate || searchTerm || listFilter !== "all") && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="min-h-[44px] touch-target w-full sm:w-auto"
              >
                <X className="mr-2 h-4 w-4" /> Clear Filters
              </Button>
            )}
          </div>
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
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index) => {
                  const txId = transactionIdString(transaction.id);
                  const transactionDate = parseTransactionDate(transaction);
                  const status = getTransactionStatus(transaction);
                  const dueLabel = formatCreditDueLabel(
                    getCreditDueAt(transaction)
                  );
                  const isHighlighted =
                    highlightId != null &&
                    highlightId !== "" &&
                    txId !== "" &&
                    txId === highlightId;
                  const canClear = isPendingCreditTransaction(transaction);

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
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant={statusBadgeVariant(status)}>
                                {status}
                              </Badge>
                              {transaction.paymentMethod === "Credit" &&
                                dueLabel && (
                                  <Badge variant="outline" className="text-xs">
                                    Due {dueLabel}
                                  </Badge>
                                )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-lg">
                              R{Number(transaction.total).toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getCustomerName(transaction.customerId)}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 pl-2">
                          {transaction.items?.map((item) => (
                            <li
                              key={`${txId || index}-${item.productId}`}
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
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="secondary">
                            {transaction.paymentMethod}
                          </Badge>
                          {canClear && (
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClearTarget(transaction);
                              }}
                            >
                              <Banknote className="h-4 w-4" />
                              Mark credit as paid
                            </Button>
                          )}
                        </div>
                        {transaction.creditDetails?.note && (
                          <p className="text-xs text-muted-foreground mt-2 pl-2">
                            Note: {transaction.creditDetails.note}
                          </p>
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
              This records payment for{" "}
              <strong>R{Number(clearTarget?.total ?? 0).toFixed(2)}</strong>{" "}
              from {getCustomerName(clearTarget?.customerId)}. The
              customer&apos;s outstanding balance will be reduced and payment
              reminders will stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearCredit.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmClearCredit();
              }}
              disabled={clearCredit.isPending}
            >
              {clearCredit.isPending ? (
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
