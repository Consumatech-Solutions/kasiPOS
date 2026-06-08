"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Package,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/components/settings-provider";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import type { PurchaseOrder } from "@/types";
import { format } from "date-fns";
import { purchaseOrdersApi } from "@/lib/api/purchase-orders";
import {
  getPurchaseOrdersFromDexie,
  savePurchaseOrdersToDexie,
  updatePurchaseOrderStatusInDexie,
} from "@/lib/entity-cache";
import { mutationQueue } from "@/lib/mutation-queue";
import { executeMutation } from "@/lib/mutation-registry";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BuyStockHistoryPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { currentStore } = settings;
  const { isOnline } = useNetworkStatus();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!currentStore) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (!isOnline) {
        const { data } = await getPurchaseOrdersFromDexie(1, 10);
        const sorted = [...data].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setPurchaseOrders(sorted);
      } else {
        const response = await purchaseOrdersApi.getAll({ page: 1, limit: 10 });
        const orders = Array.isArray(response.data)
          ? response.data
          : ((response.data as { data?: PurchaseOrder[] })?.data ?? []);
        const sortedOrders = [...orders].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        if (sortedOrders.length) await savePurchaseOrdersToDexie(sortedOrders);
        setPurchaseOrders(sortedOrders);
      }
    } catch (error: unknown) {
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [currentStore, isOnline]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: "pending" | "completed" | "cancelled"
  ) => {
    if (!orderId) return;

    try {
      setUpdatingStatus(orderId);
      if (isOnline) {
        await purchaseOrdersApi.updateStatus(orderId, { status: newStatus });
        setPurchaseOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
        feedback.success(
          t("buyStock.history.statusUpdatedTitle"),
          t("buyStock.history.statusUpdatedDesc", { status: newStatus })
        );
      } else {
        setPurchaseOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
        await updatePurchaseOrderStatusInDexie(orderId, newStatus);
        mutationQueue.add({
          mutationKey: ["purchaseOrders", "updateStatus"],
          mutationFn: () =>
            executeMutation(["purchaseOrders", "updateStatus"], {
              id: orderId,
              status: newStatus,
            }),
          variables: { id: orderId, status: newStatus },
        });
        feedback.success(
          t("buyStock.history.statusUpdatedTitle"),
          t("buyStock.history.statusUpdatedOffline")
        );
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("buyStock.history.updateFailedTitle"),
        t("buyStock.history.updateFailedHint"),
        ERROR_CODES.PURCHASE_ORDER
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "cancelled":
        return XCircle;
      default:
        return Clock;
    }
  };

  return (
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
              <CardTitle>{t("buyStock.history.title")}</CardTitle>
              <CardDescription>{t("buyStock.history.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>{t("buyStock.history.loading")}</p>
            </div>
          ) : purchaseOrders && purchaseOrders.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {purchaseOrders.map((order: any) => {
                const orderDate = order.createdAt
                  ? new Date(order.createdAt)
                  : order.date
                    ? new Date(order.date)
                    : new Date();
                return (
                  <AccordionItem value={`item-${order.id}`} key={order.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4 items-center">
                        <div className="text-left">
                          <p className="font-mono font-medium">
                            {order.orderCode}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(orderDate, "PPP")}
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          <Badge
                            variant={getStatusBadgeVariant(order.status)}
                            className="capitalize flex items-center gap-1"
                          >
                            {(() => {
                              const StatusIcon = getStatusIcon(order.status);
                              return <StatusIcon className="h-3 w-3" />;
                            })()}
                            {order.status}
                          </Badge>
                          {order.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={updatingStatus === order.id}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>
                                  {t("buyStock.history.changeStatus")}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {order.status !== "pending" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(order.id!, "pending");
                                    }}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {t("buyStock.history.markPending")}
                                  </DropdownMenuItem>
                                )}
                                {order.status !== "completed" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(
                                        order.id!,
                                        "completed"
                                      );
                                    }}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {t("buyStock.history.markCompleted")}
                                  </DropdownMenuItem>
                                )}
                                {order.status !== "cancelled" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(
                                        order.id!,
                                        "cancelled"
                                      );
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    {t("buyStock.history.markCancelled")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            R{Number(order.total || 0).toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {order.deliveryMethod}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("buyStock.history.product")}</TableHead>
                            <TableHead>{t("buyStock.history.qty")}</TableHead>
                            <TableHead>{t("buyStock.history.groupPrice")}</TableHead>
                            <TableHead className="text-right">
                              {t("buyStock.history.total")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item: any) => (
                            <TableRow key={item.productId}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>
                                R{Number(item.groupPrice || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                R{Number(item.totalPrice || 0).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="text-right mt-4 space-y-1 text-sm">
                        <div className="flex justify-end gap-4">
                          <span className="text-muted-foreground">
                            {t("buyStock.history.subtotal")}
                          </span>
                          <span>R{Number(order.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                          <span className="text-muted-foreground">
                            Delivery Fee:
                          </span>
                          <span>
                            R{Number(order.deliveryFee || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-end gap-4 font-bold text-base border-t pt-2 mt-2">
                          <span>{t("buyStock.history.total")}</span>
                          <span>R{Number(order.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      {order.id && (
                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {t("buyStock.history.status")}
                            </span>
                            <Badge
                              variant={getStatusBadgeVariant(order.status)}
                              className="capitalize flex items-center gap-1"
                            >
                              {(() => {
                                const StatusIcon = getStatusIcon(order.status);
                                return <StatusIcon className="h-3 w-3" />;
                              })()}
                              {order.status}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingStatus === order.id}
                              >
                                <MoreVertical className="mr-2 h-4 w-4" />
                                {t("buyStock.history.changeStatus")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                {t("buyStock.history.changeStatus")}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {order.status !== "pending" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id!, "pending")
                                  }
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  {t("buyStock.history.markPending")}
                                </DropdownMenuItem>
                              )}
                              {order.status !== "completed" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id!, "completed")
                                  }
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {t("buyStock.history.markCompleted")}
                                </DropdownMenuItem>
                              )}
                              {order.status !== "cancelled" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id!, "cancelled")
                                  }
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  {t("buyStock.history.markCancelled")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="mx-auto h-12 w-12" />
              <p className="mt-4">{t("buyStock.history.empty")}</p>
              <Button asChild variant="link">
                <Link href="/buy-stock">{t("buyStock.history.createOrder")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
