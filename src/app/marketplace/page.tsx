"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import { useMarketplaceOrders } from "@/hooks/use-marketplace-orders";
import { useMarketplaceStores } from "@/hooks/use-marketplace-stores";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { RequireOnlineBanner } from "@/components/require-online-banner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  MarketplaceOrder,
  MarketplaceOrderItem,
} from "@/lib/api/marketplace-orders";
import { useTranslation } from "react-i18next";

function paymentMethodLabel(
  t: (key: string) => string,
  method: MarketplaceOrder["paymentMethod"]
) {
  if (method === "Cash") return t("marketplace.payment.cash");
  if (method === "Card") return t("marketplace.payment.card");
  return t("marketplace.payment.mobileMoney");
}

export default function MarketplacePage() {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const [orderCode, setOrderCode] = useState("");
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const { findByOrderCode, foundOrder, searchLoading } = useMarketplaceOrders({
    autoLoad: false,
  });
  const { stores: marketplaces, loading: storesLoading } = useMarketplaceStores(
    { activeOnly: true, autoLoad: true }
  );

  const handleSearch = async () => {
    if (!orderCode.trim()) {
      feedback.error(
        t("marketplace.feedback.orderCodeRequiredTitle"),
        t("marketplace.feedback.orderCodeRequiredDesc"),
        t("marketplace.feedback.orderCodeRequiredHint"),
        { code: ERROR_CODES.MARKETPLACE_ORDER }
      );
      return;
    }

    try {
      await findByOrderCode(orderCode.trim());
      setSearchDialogOpen(true);
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("marketplace.feedback.orderNotFoundTitle"),
        t("marketplace.feedback.orderNotFoundHint"),
        ERROR_CODES.MARKETPLACE_ORDER
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <RequireOnlineBanner />
      <div
        className={cn(
          !isOnline && "opacity-60 pointer-events-none select-none"
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              {t("marketplace.page.title")}
            </CardTitle>
            <CardDescription className="text-sm">
              {t("marketplace.page.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <label htmlFor="order-code" className="text-sm font-medium">
                {t("marketplace.orderCode.label")}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="order-code"
                  placeholder={t("marketplace.orderCode.placeholder")}
                  className="touch-target"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={searchLoading}
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="min-h-[44px] touch-target w-full sm:w-auto whitespace-nowrap px-3 sm:px-4"
                >
                  {searchLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                      <span className="hidden sm:inline">
                        {t("marketplace.findOrder")}
                      </span>
                      <span className="sm:hidden">{t("marketplace.find")}</span>
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">
                        {t("marketplace.findOrder")}
                      </span>
                      <span className="sm:hidden">{t("marketplace.find")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t("marketplace.stores.title")}
          </h2>
          <Button
            variant="outline"
            asChild
            className="min-h-[44px] touch-target w-full sm:w-auto"
          >
            <Link href="/marketplace/orders">
              {t("marketplace.stores.viewOrders")}
            </Link>
          </Button>
        </div>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {marketplaces.map((store) => (
              <Link href={`/marketplace/${store.code}`} key={store.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                  <CardHeader className="flex-row items-center gap-4">
                    <Image
                      src={store.logoUrl || "/placeholder-store.png"}
                      alt={t("marketplace.store.logoAlt", { name: store.name })}
                      width={80}
                      height={40}
                      className="rounded-md object-contain"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/placeholder-store.png";
                      }}
                    />
                    <div>
                      <CardTitle>{store.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      {store.description ||
                        t("marketplace.store.noDescription")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {t("marketplace.dialog.title")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t("marketplace.dialog.orderCode", {
                  code: foundOrder?.orderCode ?? "",
                })}
              </DialogDescription>
            </DialogHeader>
            {foundOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {t("marketplace.dialog.marketplaceStore")}
                    </p>
                    <p className="text-sm">
                      {marketplaces.find(
                        (m) => m.code === foundOrder.marketplaceStoreId
                      )?.name || foundOrder.marketplaceStoreId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {t("marketplace.dialog.status")}
                    </p>
                    <Badge
                      variant={
                        foundOrder.status === "completed"
                          ? "default"
                          : foundOrder.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {t(`marketplace.status.${foundOrder.status}`)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {t("marketplace.dialog.paymentMethod")}
                    </p>
                    <p className="text-sm">
                      {paymentMethodLabel(t, foundOrder.paymentMethod)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {t("marketplace.dialog.date")}
                    </p>
                    <p className="text-sm">
                      {new Date(foundOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    {t("marketplace.dialog.items")}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("marketplace.table.product")}</TableHead>
                        <TableHead>{t("marketplace.table.quantity")}</TableHead>
                        <TableHead className="text-right">
                          {t("marketplace.table.unitPrice")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("marketplace.table.total")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {foundOrder.items.map(
                        (item: MarketplaceOrderItem, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              R{(Number(item.unitPrice) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              R{(Number(item.totalPrice) || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {t("marketplace.summary.subtotal")}
                    </span>
                    <span>
                      R{(Number(foundOrder.subtotal) || 0).toFixed(2)}
                    </span>
                  </div>
                  {foundOrder.vatAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("marketplace.summary.vat")}
                      </span>
                      <span>
                        R{(Number(foundOrder.vatAmount) || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {foundOrder.serviceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("marketplace.summary.serviceFee")}
                      </span>
                      <span>
                        R{(Number(foundOrder.serviceFee) || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2">
                    <span>{t("marketplace.summary.total")}</span>
                    <span>R{(Number(foundOrder.total) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
