"use client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
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
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Search, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/hooks/use-customers";
import { useMarketplaceOrders } from "@/hooks/use-marketplace-orders";
import { useMarketplaceStores } from "@/hooks/use-marketplace-stores";
import Link from "next/link";
import type { MarketplaceOrderItem } from "@/lib/api/marketplace-orders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MarketplaceOrdersPage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState<string | undefined>();

  const {
    orders: allOrders,
    loading,
    error,
    loadOrders,
  } = useMarketplaceOrders({
    page: 1,
    limit: 10,
    search: searchTerm || undefined,
    marketplaceStoreId: selectedStore,
    autoLoad: false,
  });

  const { customers: allCustomersList } = useCustomers({ initialLimit: 1000 });
  const customers = allCustomersList || [];

  const { stores: marketplaceStores } = useMarketplaceStores({
    activeOnly: true,
    autoLoad: true,
  });

  useEffect(() => {
    loadOrders({
      page: 1,
      limit: 1000,
      search: searchTerm || undefined,
      marketplaceStoreId: selectedStore,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedStore]);

  const getCustomerName = (customerId: string | undefined | null) => {
    if (!customers || !customerId) return t("marketplace.orders.notApplicable");
    return (
      customers.find((c) => c.id === String(customerId))?.name ||
      t("marketplace.orders.customerUnknown")
    );
  };

  const getStoreName = (storeCode: string) => {
    return (
      marketplaceStores.find((s) => s.code === storeCode)?.name || storeCode
    );
  };

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm("");
    setSelectedStore(undefined);
  };

  const filteredOrders = allOrders || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/marketplace">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {t("marketplace.orders.pageTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("marketplace.orders.pageDescription")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("marketplace.orders.historyTitle")}</CardTitle>
          <CardDescription>
            {t("marketplace.orders.historyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                    <span>{t("marketplace.orders.pickDate")}</span>
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

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("marketplace.orders.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={selectedStore || ""}
              onChange={(e) => setSelectedStore(e.target.value || undefined)}
              className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">{t("marketplace.orders.allStores")}</option>
              {marketplaceStores.map((store) => (
                <option key={store.id} value={store.code}>
                  {store.name}
                </option>
              ))}
            </select>

            {(selectedDate || searchTerm || selectedStore) && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="w-full sm:w-auto"
              >
                <X className="mr-2 h-4 w-4" />
                {t("marketplace.orders.clear")}
              </Button>
            )}
          </div>

          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t("marketplace.orders.loading")}
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              {t("marketplace.orders.error", { message: error })}
            </div>
          )}

          {!loading && !error && filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t("marketplace.orders.empty")}
            </div>
          )}

          {!loading && !error && filteredOrders.length > 0 && (
            <ScrollArea className="h-[600px]">
              <Accordion type="single" collapsible className="w-full">
                {filteredOrders.map((order) => (
                  <AccordionItem key={order.id} value={order.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-left">
                              {order.orderCode}
                            </p>
                            <p className="text-sm text-muted-foreground text-left">
                              {getStoreName(order.marketplaceStoreId)} •{" "}
                              {getCustomerName(order.customerId)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={
                              order.status === "completed"
                                ? "default"
                                : order.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {t(`marketplace.status.${order.status}`)}
                          </Badge>
                          <div className="text-right">
                            <p className="font-semibold">
                              R{(Number(order.total) || 0).toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(
                                new Date(order.createdAt),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              {t("marketplace.orders.marketplaceStore")}
                            </p>
                            <p className="font-medium">
                              {getStoreName(order.marketplaceStoreId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {t("marketplace.orders.customer")}
                            </p>
                            <p className="font-medium">
                              {getCustomerName(order.customerId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {t("marketplace.orders.paymentMethod")}
                            </p>
                            <p className="font-medium">{order.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {t("marketplace.orders.orderDate")}
                            </p>
                            <p className="font-medium">
                              {format(new Date(order.createdAt), "PPP p")}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("marketplace.orders.items")}
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  {t("marketplace.orders.product")}
                                </TableHead>
                                <TableHead>
                                  {t("marketplace.orders.quantity")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("marketplace.orders.unitPrice")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("marketplace.orders.total")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map(
                                (item: MarketplaceOrderItem, index: number) => (
                                  <TableRow key={index}>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                      R
                                      {(Number(item.unitPrice) || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      R
                                      {(Number(item.totalPrice) || 0).toFixed(
                                        2
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t("marketplace.orders.subtotal")}
                            </span>
                            <span>
                              R{(Number(order.subtotal) || 0).toFixed(2)}
                            </span>
                          </div>
                          {order.vatAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("marketplace.orders.vat")}
                              </span>
                              <span>
                                R{(Number(order.vatAmount) || 0).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {order.serviceFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("marketplace.orders.serviceFee")}
                              </span>
                              <span>
                                R{(Number(order.serviceFee) || 0).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-bold pt-2">
                            <span>{t("marketplace.orders.total")}</span>
                            <span>
                              R{(Number(order.total) || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
