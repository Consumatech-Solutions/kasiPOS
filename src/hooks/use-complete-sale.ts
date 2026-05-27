"use client";

import { useCallback, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { ReceiptData } from "@/components/pos/ReceiptModal";
import { productKeys } from "@/hooks/use-catalogue";
import {
  transactionsApi,
  toCreateTransactionDto,
} from "@/lib/api/transactions";
import { db } from "@/lib/db";
import { feedback } from "@/lib/feedback";
import { mutationQueue } from "@/lib/mutation-queue";
import { buildReceiptData } from "@/lib/receipt-utils";
import { saveTransactionsToDexie } from "@/lib/entity-cache";
import { parseCompleteSaleError } from "@/lib/pos/complete-sale-errors";
import {
  applySoldStockUpdates,
  buildSoldQuantityByProduct,
} from "@/lib/pos/complete-sale-stock";
import {
  resolveTransactionForApi,
  validateSaleSyncMappings,
} from "@/lib/pos/complete-sale-sync";
import type {
  Store,
  Transaction,
  TransactionDiscount,
  TransactionItem,
} from "@/types";

export type CompleteSaleInput = Omit<Transaction, "id" | "date" | "storeId">;

export type UseCompleteSaleParams = {
  ensureStore: () => Promise<Store | null | undefined>;
  isOnline: boolean;
  queryClient: QueryClient;
  selectedCustomerId: string | undefined;
  appliedVoucherCode: string | undefined;
  appliedDiscount: number;
  manualDiscount: TransactionDiscount | null;
  manualDiscountAmount: number;
  amountToPay: number;
  cartTotal: number;
  showVatInCheckout: boolean;
  onClearCart: () => void;
  onResetCheckoutUi: () => void;
  onShowReceipt: (receipt: ReceiptData) => void;
  onInsufficientStock: (message: string) => void;
};

function buildReceiptPayload(
  storeName: string,
  saleId: string,
  transaction: Omit<Transaction, "id">,
  cartTotal: number,
  discountTotal: number,
  amountToPay: number,
  showVat: boolean,
  voucherCode: string | null
): ReceiptData {
  return buildReceiptData({
    storeName,
    saleId,
    items: transaction.items,
    subtotal: cartTotal,
    discountAmount: discountTotal,
    total: amountToPay,
    paymentMethod: transaction.paymentMethod,
    showVat,
    voucherCode,
    timestamp: new Date(),
  });
}

async function runOnlineSale(
  params: UseCompleteSaleParams,
  newTransaction: Omit<Transaction, "id">,
  soldQuantityByProduct: Map<string, number>,
  toReceipt: (saleId: string) => ReceiptData,
  idempotencyKey: string
): Promise<void> {
  const syncResult = await validateSaleSyncMappings(
    newTransaction.items,
    newTransaction.customerId
  );
  if (!syncResult.ok) {
    feedback.error(syncResult.title, syncResult.message);
    return;
  }

  const resolvedTx = resolveTransactionForApi(newTransaction, syncResult.map);
  const payload = toCreateTransactionDto(
    resolvedTx as Omit<Transaction, "id"> & {
      items: Array<TransactionItem & { [k: string]: unknown }>;
    }
  );
  const response = await transactionsApi.create(payload, { idempotencyKey });

  const resData = response.data as Transaction | undefined;
  const createdId = resData?.id ?? `TXN-${Date.now()}`;
  const savedTx: Transaction = {
    ...newTransaction,
    ...resData,
    id: String(createdId),
  } as Transaction;
  await db.transactions.add(savedTx);
  await saveTransactionsToDexie([savedTx]);
  await applySoldStockUpdates(soldQuantityByProduct, params.queryClient);

  params.onClearCart();
  params.onResetCheckoutUi();
  params.onShowReceipt(toReceipt(String(createdId)));

  const creditDue =
    newTransaction.paymentMethod === "Credit"
      ? (resData?.creditDueAt ?? resData?.creditDetails?.dueAt ?? null)
      : null;
  feedback.success(
    newTransaction.paymentMethod === "Credit"
      ? "Credit sale recorded"
      : "Sale complete!",
    creditDue
      ? `Payment due ${new Date(creditDue).toLocaleString()}. View your receipt below.`
      : "View your receipt below."
  );
}

function handleOnlineSaleFailure(
  error: unknown,
  storeId: string | number | undefined,
  onResetPayment: () => void,
  onInsufficientStock: (message: string) => void
): void {
  const parsed = parseCompleteSaleError(error);
  if (process.env.NODE_ENV === "development") {
    console.error(
      "[Complete Sale] Failed",
      "status:",
      parsed.status,
      "serverMessage:",
      parsed.serverMessage,
      "storeId sent:",
      storeId,
      error
    );
  }
  onResetPayment();
  if (parsed.showInPopup) {
    onInsufficientStock(parsed.popupMessage);
    return;
  }
  const messageForUser = parsed.serverMessage ?? parsed.fallbackMessage;
  feedback.fromError(
    error,
    "Failed to complete the sale",
    messageForUser
      ? `${messageForUser} Try again or check your connection.`
      : "Check your connection and try again."
  );
}

async function runOfflineSale(
  params: UseCompleteSaleParams,
  newTransaction: Omit<Transaction, "id">,
  soldQuantityByProduct: Map<string, number>,
  toReceipt: (saleId: string) => ReceiptData,
  idempotencyKey: string
): Promise<void> {
  await applySoldStockUpdates(soldQuantityByProduct, params.queryClient);
  await db.transactions.add(newTransaction as Transaction);
  await saveTransactionsToDexie([newTransaction] as Transaction[]);

  mutationQueue.add({
    mutationKey: ["transactions", "create"],
    mutationFn: () =>
      transactionsApi.create(
        toCreateTransactionDto(
          newTransaction as Omit<Transaction, "id"> & {
            items: Array<TransactionItem & { [k: string]: unknown }>;
          }
        ),
        { idempotencyKey }
      ),
    variables: newTransaction,
  });

  const localSaleId = `LOCAL-${Date.now()}`;
  if (process.env.NODE_ENV === "development") {
    console.log("[Complete Sale] Success (offline)", { localSaleId });
  }
  params.onClearCart();
  params.onResetCheckoutUi();
  params.onShowReceipt(toReceipt(localSaleId));
  feedback.success("Sale complete!", "Order recorded.");
}

function handleOfflineSaleFailure(
  error: unknown,
  queryClient: QueryClient
): void {
  if (process.env.NODE_ENV === "development") {
    console.error("[Complete Sale] Failed (offline)", { error });
  }
  console.error("Failed to complete offline sale:", error);
  queryClient.invalidateQueries({ queryKey: productKeys.lists() });
  feedback.fromError(
    error,
    "Failed to save the sale locally",
    "Try again or check storage."
  );
}

export function useCompleteSale(params: UseCompleteSaleParams) {
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const completingSaleRef = useRef(false);

  const handleCompleteSale = useCallback(
    async (transactionDetails: CompleteSaleInput) => {
      if (completingSaleRef.current || isCompletingSale) return;
      completingSaleRef.current = true;
      setIsCompletingSale(true);
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("[Complete Sale] Started", {
            method: transactionDetails.paymentMethod,
            items: transactionDetails.items.length,
            total: transactionDetails.total,
          });
        }
        const currentStore = await params.ensureStore();
        if (!currentStore) return;

        if (process.env.NODE_ENV === "development") {
          console.log("[Complete Sale] Store resolved", {
            storeId: currentStore.id,
            isOnline: params.isOnline,
          });
        }

        const idempotencyKey = crypto.randomUUID();
        const newTransaction: Omit<Transaction, "id"> = {
          ...transactionDetails,
          date: new Date(),
          customerId:
            transactionDetails.customerId ?? params.selectedCustomerId,
          voucherCode: params.appliedVoucherCode,
          discountAmount: params.appliedDiscount,
          discount: params.manualDiscount ?? undefined,
          total: params.amountToPay,
          storeId: currentStore.id!,
          idempotencyKey,
        };

        const discountTotal =
          params.appliedDiscount + params.manualDiscountAmount;
        const toReceipt = (saleId: string) =>
          buildReceiptPayload(
            currentStore.name,
            saleId,
            newTransaction,
            params.cartTotal,
            discountTotal,
            params.amountToPay,
            params.showVatInCheckout,
            params.appliedVoucherCode ?? null
          );

        const soldQuantityByProduct = buildSoldQuantityByProduct(
          newTransaction.items
        );

        if (params.isOnline) {
          try {
            await runOnlineSale(
              params,
              newTransaction,
              soldQuantityByProduct,
              toReceipt,
              idempotencyKey
            );
            if (process.env.NODE_ENV === "development") {
              console.log("[Complete Sale] Success (online)");
            }
          } catch (error: unknown) {
            handleOnlineSaleFailure(
              error,
              newTransaction.storeId,
              params.onResetCheckoutUi,
              params.onInsufficientStock
            );
          }
        } else {
          try {
            await runOfflineSale(
              params,
              newTransaction,
              soldQuantityByProduct,
              toReceipt,
              idempotencyKey
            );
          } catch (error) {
            handleOfflineSaleFailure(error, params.queryClient);
          }
        }
      } finally {
        completingSaleRef.current = false;
        setIsCompletingSale(false);
      }
    },
    [isCompletingSale, params]
  );

  return { handleCompleteSale, isCompletingSale };
}
