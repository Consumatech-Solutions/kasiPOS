"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { PurchaseOrderItem } from "@/types";
import { purchaseOrdersApi } from "@/lib/api/purchase-orders";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { mutationQueue } from "@/lib/mutation-queue";
import { useEnsureStore } from "@/hooks/use-ensure-store";

const DELIVERY_FEE = 150.0;

export default function BuyStockCartPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ensureStore } = useEnsureStore();
  const { isOnline } = useNetworkStatus();

  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<
    "delivery" | "collection"
  >("collection");
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [confirmedOrderCode, setConfirmedOrderCode] = useState("");

  useEffect(() => {
    const storedCart = localStorage.getItem("purchaseOrderCart");
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);

  const handleQuantityChange = useCallback(
    (productId: string, newQuantity: number) => {
      setCart((prevCart) => {
        const newCart = prevCart
          .map((item) => {
            if (item.productId === productId) {
              if (newQuantity <= 0) return null;
              const updatedItem = { ...item, quantity: newQuantity };
              updatedItem.totalPrice =
                updatedItem.quantity * updatedItem.groupPrice;
              return updatedItem;
            }
            return item;
          })
          .filter(Boolean) as PurchaseOrderItem[];
        localStorage.setItem("purchaseOrderCart", JSON.stringify(newCart));
        return newCart;
      });
    },
    []
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setCart((prevCart) => {
      const newCart = prevCart.filter((item) => item.productId !== productId);
      localStorage.setItem("purchaseOrderCart", JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.totalPrice, 0),
    [cart]
  );
  const total = useMemo(
    () => subtotal + (deliveryMethod === "delivery" ? DELIVERY_FEE : 0),
    [subtotal, deliveryMethod]
  );

  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);

  const handleConfirmOrder = useCallback(async () => {
    const currentStore = await ensureStore();
    if (!currentStore) {
      return;
    }
    if (cart.length === 0) {
      feedback.error(
        t("buyStock.cart.emptyTitle"),
        t("buyStock.cart.emptyDesc"),
        t("buyStock.cart.emptyHint"),
        { code: ERROR_CODES.PURCHASE_ORDER }
      );
      return;
    }

    setIsConfirmingOrder(true);

    if (isOnline) {
      try {
        const response = await purchaseOrdersApi.create({
          items: cart,
          subtotal: subtotal,
          deliveryFee: deliveryMethod === "delivery" ? DELIVERY_FEE : 0,
          total: total,
          deliveryMethod,
        });

        const createdOrder = response.data;
        setConfirmedOrderCode(createdOrder.orderCode);
        setIsOrderConfirmed(true);
        setCart([]);
        localStorage.removeItem("purchaseOrderCart");
      } catch (error: unknown) {
        feedback.fromError(
          error,
          t("buyStock.cart.orderFailedTitle"),
          t("buyStock.cart.orderFailedHint"),
          ERROR_CODES.PURCHASE_ORDER
        );
      } finally {
        setIsConfirmingOrder(false);
      }
    } else {
      try {
        const tempOrderCode = `PO-${Date.now()}`;

        mutationQueue.add({
          mutationKey: ["purchaseOrders", "create"],
          mutationFn: () =>
            purchaseOrdersApi.create({
              items: cart,
              subtotal: subtotal,
              deliveryFee: deliveryMethod === "delivery" ? DELIVERY_FEE : 0,
              total: total,
              deliveryMethod,
            }),
          variables: { cart, subtotal, total, deliveryMethod },
        });

        setIsConfirmingOrder(false);

        setConfirmedOrderCode(tempOrderCode);
        setIsOrderConfirmed(true);
        setCart([]);
        localStorage.removeItem("purchaseOrderCart");

        feedback.success(
          t("buyStock.cart.orderRecordedTitle"),
          t("buyStock.cart.orderRecordedDesc")
        );
      } catch (error: unknown) {
        feedback.fromError(
          error,
          t("buyStock.cart.saveFailedTitle"),
          t("buyStock.cart.saveFailedHint"),
          ERROR_CODES.PURCHASE_ORDER
        );
        setIsConfirmingOrder(false);
      }
    }
  }, [cart, subtotal, total, deliveryMethod, ensureStore, isOnline, t]);

  const closeConfirmationDialog = useCallback(() => {
    setIsOrderConfirmed(false);
    router.push("/buy-stock/history");
  }, [router]);

  return (
    <>
      <div className="p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Button asChild variant="outline" size="icon">
                <Link href="/buy-stock">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <CardTitle>{t("buyStock.cart.title")}</CardTitle>
                <CardDescription>{t("buyStock.cart.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>{t("buyStock.cart.empty")}</p>
                <Button asChild variant="link">
                  <Link href="/buy-stock">{t("buyStock.cart.returnCatalogue")}</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("buyStock.cart.product")}</TableHead>
                        <TableHead>{t("buyStock.cart.groupPrice")}</TableHead>
                        <TableHead className="w-[120px]">
                          {t("buyStock.cart.quantity")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("buyStock.cart.total")}
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell>R{item.groupPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 touch-target"
                                onClick={() =>
                                  handleQuantityChange(
                                    item.productId,
                                    item.quantity - 1
                                  )
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    item.productId,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className="h-8 w-24 sm:w-28 text-center min-w-[80px]"
                                min="0"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 touch-target"
                                onClick={() =>
                                  handleQuantityChange(
                                    item.productId,
                                    item.quantity + 1
                                  )
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R{item.totalPrice.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("buyStock.cart.orderSummary")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>{t("buyStock.cart.deliveryMethod")}</Label>
                        <RadioGroup
                          value={deliveryMethod}
                          onValueChange={(value) =>
                            setDeliveryMethod(
                              value as "delivery" | "collection"
                            )
                          }
                          className="grid grid-cols-2 gap-4 mt-2"
                        >
                          <div>
                            <RadioGroupItem
                              value="collection"
                              id="collection"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="collection"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                              {t("buyStock.cart.collection")}
                              <span className="text-xs font-normal">
                                {t("buyStock.cart.free")}
                              </span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="delivery"
                              id="delivery"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="delivery"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                              {t("buyStock.cart.delivery")}
                              <span className="text-xs font-normal">
                                R{DELIVERY_FEE.toFixed(2)}
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>R{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t("buyStock.cart.deliveryFee")}</span>
                          <span>
                            R
                            {(deliveryMethod === "delivery"
                              ? DELIVERY_FEE
                              : 0
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>{t("buyStock.cart.total")}</span>
                          <span>R{total.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button
                        className="w-full min-h-[44px] touch-target"
                        size="lg"
                        onClick={handleConfirmOrder}
                        disabled={isConfirmingOrder}
                      >
                        {isConfirmingOrder && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isConfirmingOrder
                          ? t("buyStock.cart.processing")
                          : t("buyStock.cart.confirmOrder")}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isOrderConfirmed} onOpenChange={setIsOrderConfirmed}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("buyStock.cart.confirmedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("buyStock.cart.confirmedDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("buyStock.cart.yourOrderCode")}
            </p>
            <p className="text-4xl font-bold tracking-widest font-mono p-4 bg-muted rounded-lg mt-2">
              {confirmedOrderCode}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeConfirmationDialog}>
              {t("buyStock.cart.viewHistory")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
