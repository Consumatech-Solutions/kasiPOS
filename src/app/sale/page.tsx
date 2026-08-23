"use client";
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
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/settings-provider";
import { useCustomers } from "@/hooks/use-customers";
import { useProducts } from "@/hooks/use-catalogue";
import { getDb } from "@/lib/db";
import type { Transaction, TransactionItem } from "@/types";
import { Pagination } from "@/components/ui/pagination";
import type { PaginationMeta } from "@/types/pagination";
import Select from "react-select";
import { useTranslation } from "react-i18next";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { ClearCreditButton } from "@/components/transactions/clear-credit-button";
import { canClearCreditTransaction } from "@/lib/clear-credit";
import { getTransactionApiId } from "@/lib/transaction-id";
import { transactionsApi } from "@/lib/api/transactions";
import type { TransactionStatusFilter } from "@/lib/api/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { transactionKeys } from "@/hooks/use-transactions";
import { dashboardStatsKeys } from "@/hooks/use-dashboard-stats";
import { customerKeys } from "@/hooks/use-customers";
import { saveTransactionsToDexie } from "@/lib/entity-cache";
import { useEffectiveOnline } from "@/hooks/use-effective-online";

const PAGE_SIZE = 10;

export default function SalePage() {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const { settings } = useSettings();
  const { currentStore } = settings;
  const role = settings.currentUser?.role;
  const queryClient = useQueryClient();
  const { effectiveOnline } = useEffectiveOnline();

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingCreditId, setClearingCreditId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<{
    value: TransactionStatusFilter | "";
    label: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { customers: allCustomersList } = useCustomers({ initialLimit: 1000 });
  const customers = allCustomersList || [];

  const { products: allProducts } = useProducts(1, 1000, {
    storeIdForOffline: currentStore?.id ?? undefined,
  });

  const productOptions = useMemo(() => {
    return (allProducts || []).map((p) => ({
      value: String(p.id),
      label: p.name,
    }));
  }, [allProducts]);

  const customerOptions = useMemo(() => {
    return (allCustomersList || []).map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
  }, [allCustomersList]);

  const statusFilterOptions = useMemo(
    () => [
      { value: "" as const, label: t("sales.filter.allStatuses") },
      {
        value: "paid" as const,
        label: t("sales.filter.statusPaid"),
      },
      {
        value: "pending" as const,
        label: t("sales.filter.statusPending"),
      },
      {
        value: "failed" as const,
        label: t("sales.filter.statusFailed"),
      },
    ],
    [t]
  );

  const matchesStatusFilter = useCallback(
    (transaction: Transaction, status: TransactionStatusFilter) => {
      const key = String(transaction.status ?? "").toLowerCase();
      if (status === "pending") {
        // Open credit: explicit pending, or legacy credit without status
        if (key === "pending") return true;
        if (!key && transaction.paymentMethod === "Credit") return true;
        return false;
      }
      if (status === "paid") return key === "paid";
      if (status === "failed") return key === "failed";
      return true;
    },
    []
  );

  const getCustomerName = useCallback(
    (customerId: string | undefined | null, tempCustomerId?: string | null) => {
      if (!customers) return t("sales.notApplicable");
      const normalMatch = customers.find((c) => c.id === String(customerId));
      if (normalMatch) return normalMatch.name;
      const tempMatch = customers.find((c) => c.id === String(tempCustomerId));
      if (tempMatch) return tempMatch.name;
      if (
        customerId?.startsWith("temp-") ||
        tempCustomerId?.startsWith("temp-")
      ) {
        return t("sales.unsyncedCustomer");
      }
      return t("sales.notApplicable");
    },
    [customers, t]
  );

  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentStore?.id) return;
      setLoading(true);
      try {
        const db = getDb();
        const storeId = String(currentStore.id);

        // Prefer transactionCache (string backend ids). Dexie `transactions` uses ++id
        // and can replace UUIDs with local auto-increment numbers.
        let cached = (await db.transactionCache.toArray()) as Transaction[];

        if (effectiveOnline) {
          try {
            let page = 1;
            const limit = 100;
            const fromApi: Transaction[] = [];
            while (fromApi.length < 10000) {
              const res = await transactionsApi.getAll({
                storeId,
                limit,
                page,
                ...(selectedStatus?.value
                  ? { status: selectedStatus.value }
                  : {}),
              });
              const raw = res.data;
              const data = Array.isArray(raw)
                ? raw
                : raw && typeof raw === "object" && "data" in raw
                  ? (raw as { data: Transaction[] }).data
                  : [];
              if (!data.length) break;
              fromApi.push(...data);
              if (data.length < limit) break;
              page += 1;
            }
            if (fromApi.length > 0) {
              await saveTransactionsToDexie(fromApi);
              cached = (await db.transactionCache.toArray()) as Transaction[];
            }
          } catch (apiError) {
            console.warn(
              "Failed to refresh sales from API; using local cache:",
              apiError
            );
          }
        }

        const legacyRows = await db.transactions.toArray();
        const byApiId = new Map<string, Transaction>();

        for (const t of cached) {
          const apiId = getTransactionApiId(t) ?? String(t.id ?? "");
          if (!apiId) continue;
          if (t.storeId != null && String(t.storeId) !== storeId) {
            continue;
          }
          byApiId.set(apiId, {
            ...t,
            id: getTransactionApiId(t) ?? t.id,
            serverId: getTransactionApiId(t) ?? t.serverId,
          });
        }

        for (const t of legacyRows) {
          if (t.storeId == null || String(t.storeId) !== storeId) continue;
          const apiId = getTransactionApiId(t);
          if (!apiId) continue;
          if (!byApiId.has(apiId)) {
            byApiId.set(apiId, {
              ...t,
              id: apiId,
              serverId: apiId,
            });
          }
        }

        const sorted = [...byApiId.values()].sort((a, b) => {
          const aT = a.createdAt ?? String(a.date ?? "");
          const bT = b.createdAt ?? String(b.date ?? "");
          return String(bT).localeCompare(String(aT));
        });
        setAllTransactions(sorted);
      } catch (err) {
        console.error("Failed to load transactions:", err);
      } finally {
        setLoading(false);
      }
    };
    void loadTransactions();
  }, [currentStore?.id, effectiveOnline, selectedStatus?.value]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((transaction) => {
      const transactionDate = transaction.createdAt
        ? format(new Date(transaction.createdAt), "yyyy-MM-dd")
        : transaction.date
          ? format(new Date(transaction.date), "yyyy-MM-dd")
          : "";

      if (
        selectedDate &&
        transactionDate !== format(selectedDate, "yyyy-MM-dd")
      ) {
        return false;
      }

      if (
        selectedStatus?.value &&
        !matchesStatusFilter(transaction, selectedStatus.value)
      ) {
        return false;
      }

      const tempCustomerId = (
        transaction as Transaction & {
          tempCustomerId?: string | null;
        }
      ).tempCustomerId;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const customerName = getCustomerName(
          transaction.customerId,
          tempCustomerId
        ).toLowerCase();
        const txnId = String(transaction.id ?? "").toLowerCase();
        const isTransactionIdSearch = /^[0-9a-f-]{0,36}$/i.test(searchTerm);
        if (isTransactionIdSearch) {
          if (!txnId.includes(searchLower)) return false;
        } else {
          if (!customerName.includes(searchLower)) return false;
        }
      }

      if (selectedProduct) {
        const items = transaction.items || [];
        const hasProductMatch = items.some(
          (i) => String(i.productId) === selectedProduct.value
        );
        if (!hasProductMatch) return false;
      }

      if (selectedCustomer) {
        const txnCustomerId = transaction.customerId;
        const txnTempCustomerId = (
          transaction as Transaction & { tempCustomerId?: string | null }
        ).tempCustomerId;
        const matchId =
          String(txnCustomerId ?? "") === selectedCustomer.value ||
          String(txnTempCustomerId ?? "") === selectedCustomer.value;
        if (!matchId) return false;
      }

      return true;
    });
  }, [
    allTransactions,
    selectedDate,
    selectedStatus,
    searchTerm,
    selectedProduct,
    selectedCustomer,
    getCustomerName,
    matchesStatusFilter,
  ]);

  const paginationMeta: PaginationMeta = useMemo(() => {
    const total = filteredTransactions.length;
    return {
      total,
      page: currentPage,
      limit: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    };
  }, [filteredTransactions.length, currentPage]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedDate,
    searchTerm,
    selectedProduct,
    selectedCustomer,
    selectedStatus,
  ]);

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm("");
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedStatus(null);
    setCurrentPage(1);
  };

  const handleClearCredit = async (transactionId: string) => {
    setClearingCreditId(transactionId);
    try {
      const response = await transactionsApi.clearCredit(transactionId);
      const updated = response.data;
      const updatedApiId = getTransactionApiId(updated) ?? String(updated.id);
      setAllTransactions((prev) =>
        prev.map((t) =>
          getTransactionApiId(t) === updatedApiId ||
          String(t.id) === String(updated.id)
            ? { ...t, ...updated, id: updatedApiId, serverId: updatedApiId }
            : t
        )
      );
      try {
        await saveTransactionsToDexie([
          {
            ...updated,
            id: updatedApiId,
            serverId: updatedApiId,
          },
        ]);
        const db = getDb();
        const localRows = await db.transactions.toArray();
        const existing = localRows.find(
          (t) => getTransactionApiId(t) === updatedApiId
        );
        if (existing) {
          await db.transactions.put({
            ...existing,
            ...updated,
            serverId: updatedApiId,
          });
        }
      } catch (cacheError) {
        console.error("Failed to update local credit sale cache:", cacheError);
      }
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      return updated;
    } finally {
      setClearingCreditId(null);
    }
  };

  const statusLabel = (status: Transaction["status"]) => {
    const key = String(status ?? "").toLowerCase();
    if (key === "pending" || key === "") return t("sales.status.pending");
    if (key === "paid") return t("sales.status.paid");
    if (key === "failed") return t("sales.status.failed");
    return status ? String(status) : null;
  };

  const calculateSubtotal = (items: TransactionItem[]) => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateTax = (items: TransactionItem[]) => {
    return items.reduce((sum, item) => {
      const unitPrice = Number(item.unitPrice);
      const qty = Number(item.quantity);
      const taxRate = 0.15;
      return sum + unitPrice * qty * taxRate;
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">
          {t("sales.page.title")}
        </CardTitle>
        <CardDescription className="text-sm">
          {t("sales.page.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
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
                  <span>{t("sales.filter.filterByDate")}</span>
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

          <div className="relative w-full sm:w-[200px]">
            <input
              type="text"
              placeholder={t("sales.filter.searchPlaceholder")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <Select
              options={[
                { value: "", label: t("sales.filter.allProducts") },
                ...productOptions,
              ]}
              value={
                selectedProduct ?? {
                  value: "",
                  label: t("sales.filter.allProducts"),
                }
              }
              onChange={(opt) => setSelectedProduct(opt?.value ? opt : null)}
              isSearchable
              placeholder={t("sales.filter.selectProduct")}
              className="text-sm"
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <Select
              options={[
                { value: "", label: t("sales.filter.allCustomers") },
                ...customerOptions,
              ]}
              value={
                selectedCustomer ?? {
                  value: "",
                  label: t("sales.filter.allCustomers"),
                }
              }
              onChange={(opt) => setSelectedCustomer(opt?.value ? opt : null)}
              isSearchable
              placeholder={t("sales.filter.selectCustomer")}
              className="text-sm"
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <Select
              options={statusFilterOptions}
              value={
                selectedStatus ?? {
                  value: "",
                  label: t("sales.filter.allStatuses"),
                }
              }
              onChange={(opt) =>
                setSelectedStatus(
                  opt?.value
                    ? {
                        value: opt.value as TransactionStatusFilter,
                        label: opt.label,
                      }
                    : null
                )
              }
              isSearchable={false}
              placeholder={t("sales.filter.selectStatus")}
              className="text-sm"
            />
          </div>

          {(selectedDate ||
            searchTerm ||
            selectedProduct ||
            selectedCustomer ||
            selectedStatus) && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="min-h-[44px] touch-target w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" /> {t("sales.filter.clear")}
            </Button>
          )}
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          {t("sales.summary.showing", {
            pageCount: paginatedTransactions.length,
            total: filteredTransactions.length,
          })}
        </div>

        <ScrollArea className="h-[calc(100vh-22rem)]">
          {loading ? (
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              {t("sales.loading")}
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction) => {
                  const transactionDate = transaction.createdAt
                    ? new Date(transaction.createdAt)
                    : transaction.date
                      ? new Date(transaction.date)
                      : new Date();

                  const tempCustomerId = (
                    transaction as Transaction & {
                      tempCustomerId?: string | null;
                    }
                  ).tempCustomerId;

                  const customerName = getCustomerName(
                    transaction.customerId,
                    tempCustomerId
                  );

                  const subtotal = calculateSubtotal(transaction.items);
                  const tax = calculateTax(transaction.items);
                  const discountAmount = transaction.discountAmount
                    ? Number(transaction.discountAmount)
                    : 0;
                  const total = Number(transaction.total);

                  return (
                    <AccordionItem
                      value={`item-${transaction.id}`}
                      key={transaction.id}
                    >
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4">
                          <div className="text-left">
                            <p className="font-medium">
                              {t("sales.accordion.saleNumber", {
                                id:
                                  (
                                    getTransactionApiId(transaction) ??
                                    String(transaction.id ?? "")
                                  ).substring(0, 8) || t("sales.notApplicable"),
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(transactionDate, "PPP p")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t("sales.accordion.customer", {
                                name: customerName,
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">
                              {formatMoney(total)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.paymentMethod}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <div className="text-sm font-medium border-b pb-1">
                            {t("sales.detail.items")}
                          </div>
                          <ul className="space-y-2 pl-2">
                            {transaction.items?.map((item, idx) => (
                              <li
                                key={`${item.productId}-${idx}`}
                                className="flex justify-between items-start text-sm"
                              >
                                <div className="flex-1">
                                  <span className="font-medium">
                                    {item.productName}
                                  </span>
                                  <div className="text-muted-foreground text-xs mt-0.5">
                                    {t("sales.detail.qtyLine", {
                                      qty: item.quantity,
                                      unit: formatMoney(Number(item.unitPrice)),
                                    })}
                                  </div>
                                </div>
                                <span className="font-medium ml-2">
                                  {formatMoney(Number(item.totalPrice))}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="border-t pt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("sales.detail.subtotal")}
                              </span>
                              <span>{formatMoney(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("sales.detail.tax")}
                              </span>
                              <span>{formatMoney(tax)}</span>
                            </div>
                            {discountAmount > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>{t("sales.detail.discount")}</span>
                                <span>-{formatMoney(discountAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold border-t pt-1">
                              <span>{t("sales.detail.total")}</span>
                              <span>{formatMoney(total)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {canClearCreditTransaction(role, transaction) ? (
                                <ClearCreditButton
                                  transaction={transaction}
                                  role={role}
                                  customerName={customerName}
                                  onClearCredit={handleClearCredit}
                                  isClearing={
                                    clearingCreditId ===
                                    getTransactionApiId(transaction)
                                  }
                                />
                              ) : (
                                <>
                                  <Badge variant="secondary">
                                    {transaction.paymentMethod}
                                  </Badge>
                                  {transaction.paymentMethod === "Credit" ? (
                                    <Badge
                                      variant={
                                        String(
                                          transaction.status ?? ""
                                        ).toLowerCase() === "paid" ||
                                        Boolean(transaction.creditSettledAt)
                                          ? "default"
                                          : "outline"
                                      }
                                    >
                                      {statusLabel(
                                        transaction.creditSettledAt
                                          ? "paid"
                                          : (transaction.status ?? "pending")
                                      )}
                                    </Badge>
                                  ) : null}
                                </>
                              )}
                              {transaction.voucherCode && (
                                <Badge variant="outline">
                                  {t("sales.detail.voucher", {
                                    code: transaction.voucherCode,
                                  })}
                                </Badge>
                              )}
                              {transaction.creditSettledAt ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("sales.clearCredit.settledAt", {
                                    date: format(
                                      new Date(transaction.creditSettledAt),
                                      "PPP p"
                                    ),
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              ) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                  {t("sales.empty")}
                </div>
              )}
            </Accordion>
          )}
        </ScrollArea>

        {paginationMeta.totalPages > 1 && (
          <div className="mt-4">
            <Pagination meta={paginationMeta} onPageChange={setCurrentPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
