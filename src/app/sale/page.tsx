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
import { useState, useEffect, useMemo } from "react";
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

const PAGE_SIZE = 10;

export default function SalePage() {
  const { settings } = useSettings();
  const { currentStore } = settings;

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getCustomerName = (
    customerId: string | undefined | null,
    tempCustomerId?: string | null
  ) => {
    if (!customers) return "N/A";
    const normalMatch = customers.find((c) => c.id === String(customerId));
    if (normalMatch) return normalMatch.name;
    const tempMatch = customers.find((c) => c.id === String(tempCustomerId));
    if (tempMatch) return tempMatch.name;
    if (
      customerId?.startsWith("temp-") ||
      tempCustomerId?.startsWith("temp-")
    ) {
      return "Unsynced Customer";
    }
    return "N/A";
  };

  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentStore?.id) return;
      setLoading(true);
      try {
        const db = getDb();
        const txns = await db.transactions.toArray();
        const filtered = txns.filter(
          (t) =>
            t.storeId != null && String(t.storeId) === String(currentStore.id)
        );
        const sorted = filtered.sort((a, b) => {
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
    loadTransactions();
  }, [currentStore?.id]);

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
    searchTerm,
    selectedProduct,
    selectedCustomer,
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
  }, [selectedDate, searchTerm, selectedProduct, selectedCustomer]);

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm("");
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setCurrentPage(1);
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
        <CardTitle className="text-lg sm:text-xl">Sales</CardTitle>
        <CardDescription className="text-sm">
          Detailed view of all sales transactions.
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

          <div className="relative w-full sm:w-[200px]">
            <input
              type="text"
              placeholder="Customer or Order #"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <Select
              options={[
                { value: "", label: "All Products" },
                ...productOptions,
              ]}
              value={selectedProduct ?? { value: "", label: "All Products" }}
              onChange={(opt) => setSelectedProduct(opt?.value ? opt : null)}
              isSearchable
              placeholder="Select product"
              className="text-sm"
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <Select
              options={[
                { value: "", label: "All Customers" },
                ...customerOptions,
              ]}
              value={selectedCustomer ?? { value: "", label: "All Customers" }}
              onChange={(opt) => setSelectedCustomer(opt?.value ? opt : null)}
              isSearchable
              placeholder="Select customer"
              className="text-sm"
            />
          </div>

          {(selectedDate ||
            searchTerm ||
            selectedProduct ||
            selectedCustomer) && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="min-h-[44px] touch-target w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" /> Clear Filters
            </Button>
          )}
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {paginatedTransactions.length} of{" "}
          {filteredTransactions.length} sales
        </div>

        <ScrollArea className="h-[calc(100vh-22rem)]">
          {loading ? (
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              Loading sales...
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
                              Sale #
                              {String(transaction.id ?? "").substring(0, 8) ||
                                "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(transactionDate, "PPP p")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Customer: {customerName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">
                              R{total.toFixed(2)}
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
                            Items
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
                                    Qty: {item.quantity} x R{" "}
                                    {Number(item.unitPrice).toFixed(2)}
                                  </div>
                                </div>
                                <span className="font-medium ml-2">
                                  R{Number(item.totalPrice).toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="border-t pt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Subtotal
                              </span>
                              <span>R{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Tax</span>
                              <span>R{tax.toFixed(2)}</span>
                            </div>
                            {discountAmount > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Discount</span>
                                <span>-R{discountAmount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold border-t pt-1">
                              <span>Total</span>
                              <span>R{total.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <Badge variant="secondary">
                              {transaction.paymentMethod}
                            </Badge>
                            {transaction.voucherCode && (
                              <Badge variant="outline">
                                Voucher: {transaction.voucherCode}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              ) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                  No sales found for the selected filters.
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
