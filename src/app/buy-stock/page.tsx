"use client";

import { useState, useMemo } from "react";
import type { PurchaseOrderItem } from "@/types";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import { useSettings } from "@/components/settings-provider";
import { useProducts } from "@/hooks/use-catalogue";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { History, ShoppingCart, Info, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useStoreCurrency } from "@/hooks/use-store-currency";

export default function BuyStockPage() {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const { settings } = useSettings();
  const { hasInternet } = useNetworkStatus();
  const { currentStore } = settings;

  const { products: apiProducts, loading: productsLoading } = useProducts(
    1,
    1000,
    {
      storeIdForOffline: currentStore?.id ?? undefined,
    }
  );
  const allProducts = apiProducts || [];

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const lowStockItems = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(
      (p: any) =>
        (p.lowStockThreshold || 0) > 0 &&
        (p.stock ?? 0) <= (p.lowStockThreshold || 0)
    );
  }, [allProducts]);

  const handleQuantityChange = (productId: string, value: string) => {
    const newQuantity = parseInt(value, 10);
    setQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(newQuantity) ? 0 : newQuantity,
    }));
  };

  const getGroupPrice = (costPrice: number | string) => {
    const numPrice = Number(costPrice) || 0;
    return numPrice * 0.9;
  };

  const handleAddToCart = (product: any) => {
    if (!product.id) return;

    const quantity = quantities[product.id] || 0;
    if (quantity <= 0) {
      feedback.error(
        t("buyStock.feedback.noQuantityTitle"),
        t("buyStock.feedback.noQuantityDesc"),
        t("buyStock.feedback.noQuantityHint"),
        { code: ERROR_CODES.PURCHASE_ORDER }
      );
      return;
    }

    const costPrice = Number(product.costPrice) || 0;

    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: costPrice,
      groupPrice: getGroupPrice(costPrice),
      totalPrice: quantity * getGroupPrice(costPrice),
    };

    const cart: PurchaseOrderItem[] = JSON.parse(
      localStorage.getItem("purchaseOrderCart") || "[]"
    );
    const existingItemIndex = cart.findIndex(
      (item) => item.productId === product.id
    );

    if (existingItemIndex > -1) {
      cart[existingItemIndex].quantity += quantity;
      cart[existingItemIndex].totalPrice =
        cart[existingItemIndex].quantity * cart[existingItemIndex].groupPrice;
    } else {
      cart.push(newItem);
    }

    localStorage.setItem("purchaseOrderCart", JSON.stringify(cart));

    feedback.success(
      t("buyStock.feedback.addedTitle"),
      t("buyStock.feedback.addedDesc", {
        quantity,
        productName: product.name,
      })
    );
  };

  return (
    <div className="p-2 sm:p-4 space-y-4 sm:space-y-6">
      <div
        className={cn(
          !hasInternet && "opacity-60 pointer-events-none select-none"
        )}
      >
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                {t("buyStock.page.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("buyStock.page.description")}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="min-h-[44px] touch-target w-full sm:w-auto"
              >
                <Link href="/buy-stock/history">
                  <History className="mr-2 h-4 w-4" />
                  {t("buyStock.actions.orderHistory")}
                </Link>
              </Button>
              <Button
                asChild
                className="min-h-[44px] touch-target w-full sm:w-auto"
              >
                <Link href="/buy-stock/cart">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t("buyStock.actions.viewCart")}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
              <Info className="h-4 w-4 !text-blue-800" />
              <AlertTitle>{t("buyStock.alert.title")}</AlertTitle>
              <AlertDescription>
                {t("buyStock.alert.beforeBold")}
                <span className="font-bold">
                  {t("buyStock.alert.boldLabel")}
                </span>
                {t("buyStock.alert.afterBold")}
              </AlertDescription>
            </Alert>

            {lowStockItems && lowStockItems.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                  {t("buyStock.lowStock.title")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("buyStock.lowStock.hint")}
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("buyStock.table.product")}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t("buyStock.table.stock")}
                        </TableHead>
                        <TableHead>{t("buyStock.table.groupPrice")}</TableHead>
                        <TableHead className="w-[100px]">
                          {t("buyStock.table.quantity")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("buyStock.table.action")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((product: any) => (
                        <TableRow
                          key={product.id}
                          className="bg-amber-50 hover:bg-amber-100"
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                <Badge
                                  variant="destructive"
                                  className="mt-1 w-fit"
                                >
                                  {t("buyStock.stockLeft", {
                                    count: product.stock ?? 0,
                                  })}
                                </Badge>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="destructive">
                              {t("buyStock.stockLeft", {
                                count: product.stock ?? 0,
                              })}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatMoney(
                              getGroupPrice(Number(product.costPrice) || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-10 sm:h-9 touch-target"
                              placeholder="0"
                              value={quantities[product.id] || ""}
                              onChange={(e) =>
                                handleQuantityChange(product.id, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="min-h-[44px] touch-target w-full sm:w-auto"
                              onClick={() => handleAddToCart(product)}
                            >
                              <Plus />{" "}
                              <span className="hidden sm:inline">
                                {t("buyStock.add")}
                              </span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">
                {t("buyStock.catalog.title")}
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("buyStock.table.product")}</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        {t("buyStock.table.currentStock")}
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("buyStock.table.unitPrice")}
                      </TableHead>
                      <TableHead>{t("buyStock.table.groupPrice")}</TableHead>
                      <TableHead className="w-[100px]">
                        {t("buyStock.table.quantity")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("buyStock.table.action")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          {t("buyStock.loadingProducts")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      allProducts?.map((product: any) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {t("buyStock.mobileStock", {
                                  count: product.stock ?? 0,
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {product.stock ?? 0}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatMoney(Number(product.costPrice) || 0)}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatMoney(
                              getGroupPrice(Number(product.costPrice) || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-10 sm:h-9 touch-target"
                              placeholder="0"
                              value={quantities[product.id] || ""}
                              onChange={(e) =>
                                handleQuantityChange(product.id, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="min-h-[44px] touch-target w-full sm:w-auto"
                              onClick={() => handleAddToCart(product)}
                            >
                              <Plus />{" "}
                              <span className="hidden sm:inline">
                                {t("buyStock.add")}
                              </span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
