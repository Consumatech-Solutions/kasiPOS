"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";

import type {
  Product,
  Transaction,
  TransactionItem,
  Customer,
  TransactionDiscount,
} from "@/types";
import { db, getDb } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Search, QrCode, LayoutGrid, List } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import PaymentModal from "@/components/pos/PaymentModal";
import {
  PosSalePanel,
  type PosSalePanelProps,
} from "@/components/pos/PosSalePanel";
import { PosMobileCartSheet } from "@/components/pos/PosMobileCartSheet";
import VoucherModal from "@/components/pos/VoucherModal";
import ApplyDiscountModal from "@/components/pos/ApplyDiscountModal";
import CreditSaleModal from "@/components/pos/CreditSaleModal";
import { ReceiptModal, type ReceiptData } from "@/components/pos/ReceiptModal";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useSettings } from "@/components/settings-provider";
import { useCustomers } from "@/hooks/use-customers";
import { useCategories, useProducts, productKeys } from "@/hooks/use-catalogue";
import {
  transactionsApi,
  toCreateTransactionDto,
} from "@/lib/api/transactions";
import { feedback } from "@/lib/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { mutationQueue } from "@/lib/mutation-queue";
import { getProductInitials } from "@/lib/utils/product-initials";
import { useEnsureStore } from "@/hooks/use-ensure-store";
import { useCart } from "@/components/providers/cart-provider";
import { buildReceiptData as buildReceiptDataFromUtil } from "@/lib/receipt-utils";
import {
  updateProductStockInDexie,
  saveTransactionsToDexie,
} from "@/lib/entity-cache";
import { catalogueApi } from "@/lib/api/catalogue";
import { Pagination } from "@/components/ui/pagination";
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
import { useTranslation } from "react-i18next";

type PosAlertTitleKey = "stock" | "credit" | "notice";

export default function PosPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { ensureStore } = useEnsureStore();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();

  const { cart, addToCart, updateQuantity, clearCart, isCartHydrated } =
    useCart();
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryView, setCategoryView] = useState<"carousel" | "grid">(
    "carousel"
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [activePaymentMethod, setActivePaymentMethod] = useState<
    "Cash" | "Card" | "Mobile Money" | null
  >(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isApplyDiscountModalOpen, setIsApplyDiscountModalOpen] =
    useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedVoucherCode, setAppliedVoucherCode] = useState<
    string | undefined
  >(undefined);
  const [manualDiscount, setManualDiscount] =
    useState<TransactionDiscount | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isClearCartDialogOpen, setIsClearCartDialogOpen] = useState(false);
  const [insufficientStockPopup, setInsufficientStockPopup] = useState<{
    open: boolean;
    message: string;
    titleKey: PosAlertTitleKey;
  }>({ open: false, message: "", titleKey: "stock" });
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const clearCartAndResetCoupons = () => {
    clearCart();
    setAppliedDiscount(0);
    setAppliedVoucherCode(undefined);
    setManualDiscount(null);
    setIsClearCartDialogOpen(false);
  };

  const { categories: apiCategories, loading: categoriesLoading } =
    useCategories(1, 1000, {
      storeIdForOffline: settings?.currentStore?.id ?? undefined,
    });
  const {
    products: apiProducts,
    pagination: productsPagination,
    loading: productsLoading,
    setFilters,
    loadPage,
  } = useProducts(1, 20, {
    storeIdForOffline: settings?.currentStore?.id ?? undefined,
  });

  const products = apiProducts;

  const categoryId = useMemo(() => {
    if (!activeCategory || !apiCategories) return undefined;
    return apiCategories.find((c) => c.name === activeCategory)?.id;
  }, [activeCategory, apiCategories]);

  const prevCategoryIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev: any) => ({ ...prev, search: productSearch }));
      loadPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearch, loadPage, setFilters]);

  useEffect(() => {
    if (categoryId !== prevCategoryIdRef.current) {
      prevCategoryIdRef.current = categoryId;
      setFilters((prev: any) => ({ ...prev, categoryId }));
      loadPage(1);
    }
  }, [categoryId, loadPage, setFilters]);

  const allCategories = useMemo(() => {
    if (!apiCategories) return [];
    return apiCategories.map((c) => c.name);
  }, [apiCategories]);

  const filteredCategories = useMemo(() => {
    if (!allCategories) return [];
    return allCategories.filter((c) =>
      c.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [allCategories, categorySearch]);

  const { customers: allCustomersList } = useCustomers({ initialLimit: 1000 });

  const customers = allCustomersList || [];

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId || !customers) return undefined;
    return customers.find((c) => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(
      (customer: Customer) =>
        customer.name
          .toLowerCase()
          .includes(customerSearchTerm.toLowerCase()) ||
        customer.contact?.includes(customerSearchTerm)
    );
  }, [customers, customerSearchTerm]);

  const selectCategory = (category: string | null) => {
    setActiveCategory(category);
    setCategoryView("carousel");
  };

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce(
    (acc, item) => acc + item.totalPrice,
    0
  );
  const manualDiscountAmount = useMemo(() => {
    if (!manualDiscount) return 0;
    if (manualDiscount.discountType === "percentage") {
      return (
        Math.round(
          ((cartSubtotal * manualDiscount.discountAmount) / 100) * 100
        ) / 100
      );
    }
    return Math.min(cartSubtotal, Math.max(0, manualDiscount.discountAmount));
  }, [manualDiscount, cartSubtotal]);
  const cartTotal = cartSubtotal - appliedDiscount - manualDiscountAmount;
  const VAT_RATE = 15;
  const showVatInCheckout = settings.showVatInCheckout !== false;
  const vatAmount = showVatInCheckout ? cartTotal * (VAT_RATE / 100) : 0;
  const amountToPay = showVatInCheckout ? cartTotal + vatAmount : cartTotal;
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleOpenVoucherModal = () => {
    if (cartSubtotal < 5) {
      feedback.error(
        t("pos.feedback.voucherMinTitle"),
        t("pos.feedback.voucherMinDescription"),
        t("pos.feedback.voucherMinHint")
      );
      return;
    }
    setIsVoucherModalOpen(true);
  };

  const creditConfigured = settings?.currentStore?.credit != null;

  const handleCheckout = (
    method: "Cash" | "Card" | "Mobile Money" | "Credit"
  ) => {
    if (cart.size === 0) {
      feedback.error(
        t("pos.feedback.cartEmptyTitle"),
        t("pos.feedback.cartEmptyDescription"),
        t("pos.feedback.cartEmptyHint")
      );
      return;
    }
    if (method === "Credit") {
      if (!creditConfigured) {
        feedback.error(
          t("pos.feedback.creditNotConfiguredTitle"),
          t("pos.feedback.creditNotConfiguredDescription"),
          t("pos.feedback.creditNotConfiguredHint")
        );
        return;
      }
      setIsCreditModalOpen(true);
      return;
    }
    setActivePaymentMethod(method);
  };

  const salePanelProps: PosSalePanelProps = {
    cartItems,
    isCartHydrated,
    cartSubtotal,
    vatAmount,
    amountToPay,
    appliedDiscount,
    manualDiscountAmount,
    showVatInCheckout,
    settings,
    selectedCustomer,
    campaignsEnabled: !!settings?.campaigns,
    onOpenCustomerDialog: () => {
      setCustomerSearchTerm("");
      setCustomerDialogOpen(true);
    },
    onOpenVoucherModal: handleOpenVoucherModal,
    onOpenDiscountModal: () => setIsApplyDiscountModalOpen(true),
    onCheckout: handleCheckout,
    onClearCart: () => setIsClearCartDialogOpen(true),
    updateQuantity,
    onInsufficientStock: (message) =>
      setInsufficientStockPopup({
        open: true,
        titleKey: "stock",
        message,
      }),
  };

  const creditLimit =
    settings?.currentStore?.credit?.customerCredit?.creditLimit;

  const handleConfirmCreditSale = (payload: {
    customerId: string;
    paymentDate?: string;
    note?: string;
  }) => {
    handleCompleteSale({
      items: cartItems,
      total: amountToPay,
      paymentMethod: "Credit",
      customerId: payload.customerId,
      creditDetails: {
        ...(payload.paymentDate && { paymentDate: payload.paymentDate }),
        ...(payload.note && { note: payload.note }),
      },
    });
    setIsCreditModalOpen(false);
  };

  const handleApplyVoucher = (code: string, amount: number) => {
    setAppliedVoucherCode(code);
    setAppliedDiscount(amount);
    feedback.success(
      t("pos.feedback.voucherAppliedTitle"),
      t("pos.feedback.voucherAppliedDescription", {
        amount: amount.toFixed(2),
      })
    );
  };

  const handleApplyManualDiscount = (discount: TransactionDiscount) => {
    setManualDiscount(discount);
    const amount =
      discount.discountType === "percentage"
        ? (cartSubtotal * discount.discountAmount) / 100
        : discount.discountAmount;
    feedback.success(
      t("pos.feedback.discountAppliedTitle"),
      t("pos.feedback.discountAppliedDescription", {
        amount: amount.toFixed(2),
      })
    );
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDialogOpen(false);
  };

  const addScannedProductToCart = (productByBarcode: any) => {
    const currentQty = cart.get(productByBarcode.id)?.quantity ?? 0;
    const stock = productByBarcode.stock ?? null;
    if (typeof stock === "number" && stock < currentQty + 1) {
      setInsufficientStockPopup({
        open: true,
        titleKey: "stock",
        message: t("pos.stock.insufficient", {
          productName: productByBarcode.name,
          stock: String(stock),
        }),
      });
      return;
    }
    const productForCart = {
      id: productByBarcode.id,
      name: productByBarcode.name,
      price: productByBarcode.price,
      costPrice: productByBarcode.costPrice,
      stock: productByBarcode.stock ?? 0,
      category:
        typeof productByBarcode.category === "string"
          ? productByBarcode.category
          : productByBarcode.category?.name || "",
      barCode: productByBarcode.barCode || undefined,
      imageUrl: productByBarcode.productImage || "",
      productImage: productByBarcode.productImage || undefined,
    } as Product;
    addToCart(productForCart);
    feedback.success(
      t("pos.feedback.productAddedTitle"),
      t("pos.feedback.productAddedDescription", {
        name: productByBarcode.name,
      })
    );
  };

  const handleBarcodeScan = async (barcode: string) => {
    const productByBarcode = products?.find((p) => p.barCode === barcode);

    if (productByBarcode) {
      addScannedProductToCart(productByBarcode);
      return;
    }

    try {
      const response = await catalogueApi.products.getAll({
        page: 1,
        limit: 20,
        search: barcode,
      });
      const remoteProducts = Array.isArray(response)
        ? response
        : (response.data ?? []);
      const exactMatch = remoteProducts.find((p) => p.barCode === barcode);
      if (exactMatch) {
        addScannedProductToCart(exactMatch);
        return;
      }
    } catch {
      // Fallback to existing UX if lookup fails.
    }

    setProductSearch(barcode);
    setCategoryView("carousel");
    loadPage(1);
    feedback.success(
      t("pos.feedback.barcodeNoProductTitle"),
      t("pos.feedback.barcodeNoProductDescription", { barcode })
    );
  };

  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const completingSaleRef = useRef(false);

  const handleCompleteSale = async (
    transactionDetails: Omit<Transaction, "id" | "date" | "storeId">
  ) => {
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
      const currentStore = await ensureStore();
      if (!currentStore) return;

      if (process.env.NODE_ENV === "development") {
        console.log("[Complete Sale] Store resolved", {
          storeId: currentStore.id,
          isOnline: isOnline,
        });
      }
      const idempotencyKey = crypto.randomUUID();
      const newTransaction: Omit<Transaction, "id"> = {
        ...transactionDetails,
        date: new Date(),
        customerId: transactionDetails.customerId ?? selectedCustomerId,
        voucherCode: appliedVoucherCode,
        discountAmount: appliedDiscount,
        discount: manualDiscount ?? undefined,
        total: amountToPay,
        storeId: currentStore.id!,
        idempotencyKey,
      };

      const toReceiptData = (saleId: string): ReceiptData =>
        buildReceiptDataFromUtil({
          storeName: currentStore.name,
          saleId,
          items: newTransaction.items,
          subtotal: cartTotal,
          discountAmount: appliedDiscount + manualDiscountAmount,
          total: amountToPay,
          paymentMethod: newTransaction.paymentMethod,
          showVat: showVatInCheckout,
          voucherCode: appliedVoucherCode ?? null,
          timestamp: new Date(),
        });

      const soldQuantityByProduct = new Map<string, number>();
      for (const item of newTransaction.items) {
        const pid = String(item.productId);
        soldQuantityByProduct.set(
          pid,
          (soldQuantityByProduct.get(pid) ?? 0) + item.quantity
        );
      }

      if (isOnline) {
        try {
          const mappings = await getDb().syncIdMapping.toArray();
          const map = new Map(mappings.map((m) => [m.tempId, m.serverId]));
          const unresolvedProductIds = newTransaction.items
            .map((item) => String(item.productId))
            .filter((id) => id.startsWith("temp-") && !map.has(id));
          if (unresolvedProductIds.length > 0) {
            feedback.error(
              t("pos.feedback.productsSyncingTitle"),
              t("pos.feedback.productsSyncingDescription")
            );
            return;
          }
          const unresolvedCustomerId =
            newTransaction.customerId &&
            String(newTransaction.customerId).startsWith("temp-") &&
            !map.has(String(newTransaction.customerId));
          if (unresolvedCustomerId) {
            feedback.error(
              t("pos.feedback.customerSyncingTitle"),
              t("pos.feedback.customerSyncingDescription")
            );
            return;
          }
          const resolvedItems = newTransaction.items.map((item) => ({
            ...item,
            productId:
              map.get(String(item.productId)) ?? String(item.productId),
          }));
          const resolvedCustomerId =
            newTransaction.customerId &&
            String(newTransaction.customerId).startsWith("temp-")
              ? (map.get(String(newTransaction.customerId)) ??
                newTransaction.customerId)
              : newTransaction.customerId;
          const resolvedTx = {
            ...newTransaction,
            items: resolvedItems,
            customerId: resolvedCustomerId,
          };
          const payload = toCreateTransactionDto(
            resolvedTx as Omit<Transaction, "id"> & {
              items: Array<TransactionItem & { [k: string]: unknown }>;
            }
          );
          const response = await transactionsApi.create(payload, {
            idempotencyKey,
          });

          const resData = response.data as
            | { id?: string; data?: { id?: string } }
            | undefined;
          const createdId =
            resData?.id ?? resData?.data?.id ?? `TXN-${Date.now()}`;
          await db.transactions.add({
            ...newTransaction,
            id: String(createdId),
          } as Transaction);

          for (const [pid, soldQty] of soldQuantityByProduct.entries()) {
            const product = await getDb().productCache.get(pid);
            if (product && typeof product.stock === "number") {
              const newStock = Math.max(0, product.stock - soldQty);
              await updateProductStockInDexie(pid, newStock);

              queryClient.setQueriesData(
                { queryKey: productKeys.lists() },
                (oldData: any) => {
                  if (!oldData || !oldData.data) return oldData;
                  return {
                    ...oldData,
                    data: oldData.data.map((p: any) =>
                      String(p.id) === pid ? { ...p, stock: newStock } : p
                    ),
                  };
                }
              );
            }
          }

          clearCartAndResetCoupons();
          setSelectedCustomerId(undefined);
          setActivePaymentMethod(null);
          const receiptPayload = toReceiptData(String(createdId));
          setReceiptData(receiptPayload);
          setTimeout(() => setReceiptOpen(true), 0);

          if (process.env.NODE_ENV === "development") {
            console.log("[Complete Sale] Success (online)", {
              createdId: resData?.id ?? resData?.data?.id,
            });
          }
          feedback.success(
            t("pos.feedback.saleCompleteTitle"),
            t("pos.feedback.saleCompleteOnlineHint")
          );
        } catch (error: unknown) {
          const err = error as {
            message?: string;
            response?: { status?: number; data?: unknown };
          };
          const response = err?.response as
            | { status?: number; data?: unknown }
            | undefined;
          const status = response?.status;
          const data = response?.data as Record<string, unknown> | undefined;
          let serverMessage: string | undefined;
          if (data && typeof data === "object") {
            if (typeof data.message === "string") serverMessage = data.message;
            else if (Array.isArray(data.message) && data.message[0] != null)
              serverMessage = String(data.message[0]);
            else if (Array.isArray(data.errors) && data.errors[0] != null)
              serverMessage = String(data.errors[0]);
            else if (typeof data.error === "string") serverMessage = data.error;
            else if (typeof (data as { message?: string }).message === "string")
              serverMessage = (data as { message?: string }).message;
          }
          const fallbackMessage =
            err?.message ??
            (error instanceof Error ? error.message : String(error));

          if (process.env.NODE_ENV === "development") {
            console.error(
              "[Complete Sale] Failed",
              "status:",
              status,
              "serverMessage:",
              serverMessage,
              "storeId sent:",
              newTransaction?.storeId
            );
            if (data)
              console.error(
                "[Complete Sale] Response data:",
                JSON.stringify(data)
              );
            console.error("[Complete Sale] Error:", error);
          }

          setActivePaymentMethod(null);
          const messageForUser = serverMessage ?? fallbackMessage;
          const showInPopup =
            status != null &&
            status >= 400 &&
            status < 500 &&
            (messageForUser || status === 400);
          const isStoreIdError =
            messageForUser && /storeId|integer/i.test(messageForUser);
          const isCreditNotConfigured =
            messageForUser &&
            /credit.*not configured|not configured.*credit/i.test(
              messageForUser
            );
          const popupMessage = isStoreIdError
            ? t("pos.error.storeConfig")
            : isCreditNotConfigured
              ? t("pos.error.creditSettings")
              : messageForUser || t("pos.error.generic");
          if (showInPopup) {
            setInsufficientStockPopup({
              open: true,
              message: popupMessage,
              titleKey: isCreditNotConfigured ? "credit" : "notice",
            });
          } else {
            feedback.fromError(
              error,
              t("pos.feedback.failedSaleTitle"),
              messageForUser
                ? t("pos.feedback.failedSaleTrySuffix", {
                    message: messageForUser,
                  })
                : t("pos.feedback.failedSaleConnectionHint")
            );
          }
        }
      } else {
        try {
          for (const [pid, soldQty] of soldQuantityByProduct.entries()) {
            const product = await getDb().productCache.get(pid);
            if (product && typeof product.stock === "number") {
              const newStock = Math.max(0, product.stock - soldQty);
              await updateProductStockInDexie(pid, newStock);

              queryClient.setQueriesData(
                { queryKey: productKeys.lists() },
                (oldData: any) => {
                  if (!oldData || !oldData.data) return oldData;
                  return {
                    ...oldData,
                    data: oldData.data.map((p: any) =>
                      String(p.id) === pid ? { ...p, stock: newStock } : p
                    ),
                  };
                }
              );
            }
          }

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
          clearCartAndResetCoupons();
          setSelectedCustomerId(undefined);
          setActivePaymentMethod(null);
          const receiptPayload = toReceiptData(localSaleId);
          setReceiptData(receiptPayload);
          setTimeout(() => setReceiptOpen(true), 0);

          feedback.success(
            t("pos.feedback.saleCompleteTitle"),
            t("pos.feedback.saleCompleteOfflineHint")
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[Complete Sale] Failed (offline)", { error });
          }
          console.error("Failed to complete offline sale:", error);

          queryClient.invalidateQueries({ queryKey: productKeys.lists() });

          feedback.fromError(
            error,
            t("pos.feedback.failedSaleLocalTitle"),
            t("pos.feedback.failedSaleLocalHint")
          );
        }
      }
    } finally {
      completingSaleRef.current = false;
      setIsCompletingSale(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full min-h-[85vh] lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col overflow-x-hidden pb-20 lg:pb-4">
      <div className="flex-1 lg:min-h-0 lg:overflow-hidden py-4 px-2 sm:px-4 bg-muted max-lg:flex max-lg:flex-col max-lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 min-h-[80vh] max-lg:flex-1 max-lg:min-h-0 max-lg:flex max-lg:flex-col lg:min-h-0 lg:h-full min-w-0 w-full">
          {/* Product Selection — first column: fixed height on desktop, product list scrolls independently */}
          <div className="lg:col-span-1 xl:col-span-1 min-w-0 min-h-[200px] max-lg:max-h-none max-lg:flex-1 lg:max-h-none lg:h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-card rounded-lg p-2 sm:p-4 order-1">
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder={
                  categoryView === "grid"
                    ? t("pos.search.categoriesPlaceholder")
                    : t("pos.search.productsPlaceholder")
                }
                className="pl-10 pr-10 h-12"
                value={categoryView === "grid" ? categorySearch : productSearch}
                onChange={(e) =>
                  categoryView === "grid"
                    ? setCategorySearch(e.target.value)
                    : setProductSearch(e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => setIsBarcodeScannerOpen(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title={t("pos.scanBarcode.buttonTitle")}
              >
                <QrCode className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>

            <div className="flex justify-between items-center mb-2 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                {t("pos.categories.heading")}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 touch-target"
                onClick={() =>
                  setCategoryView((prev) =>
                    prev === "carousel" ? "grid" : "carousel"
                  )
                }
              >
                {categoryView === "carousel" ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <List className="h-4 w-4" />
                )}
              </Button>
            </div>

            {categoryView === "carousel" ? (
              <Carousel
                opts={{ align: "start", slidesToScroll: "auto" }}
                className="w-full mb-4 shrink-0"
              >
                <CarouselContent className="-ml-2">
                  <CarouselItem className="basis-auto pl-2">
                    <Button
                      variant={
                        activeCategory === null ? "secondary" : "outline"
                      }
                      size="sm"
                      onClick={() => selectCategory(null)}
                    >
                      {t("pos.categories.all")}
                    </Button>
                  </CarouselItem>
                  {apiCategories.map((cat) => (
                    <CarouselItem key={cat.id} className="basis-auto pl-2">
                      <Button
                        variant={
                          activeCategory === cat.name ? "secondary" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          selectCategory(
                            activeCategory === cat.name ? null : cat.name
                          )
                        }
                      >
                        {cat.name}
                      </Button>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2" />
                <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2" />
              </Carousel>
            ) : null}

            {categoryView === "grid" ? (
              <ScrollArea className="flex-1 min-h-0 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  <button
                    onClick={() => selectCategory(null)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-center p-2 transition-colors ${activeCategory === null ? "bg-secondary text-secondary-foreground" : "bg-card hover:bg-accent hover:text-accent-foreground border"}`}
                  >
                    <p className="font-semibold">{t("pos.categories.all")}</p>
                  </button>
                  {filteredCategories?.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-center p-2 transition-colors ${activeCategory === cat ? "bg-secondary text-secondary-foreground" : "bg-card hover:bg-accent hover:text-accent-foreground border"}`}
                    >
                      <p className="font-semibold">{cat}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase shrink-0">
                  {t("pos.products.heading")}
                </p>
                <ScrollArea className="flex-1 min-h-0 min-w-0 w-full pr-1">
                  <div
                    className="w-full min-w-0"
                    data-testid="pos-product-table"
                  >
                    <Table noScrollWrapper className="w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-0">
                            {t("pos.products.table.product")}
                          </TableHead>
                          <TableHead className="hidden md:table-cell w-16 shrink-0">
                            {t("pos.products.table.stock")}
                          </TableHead>
                          <TableHead className="w-20 shrink-0">
                            {t("pos.products.table.price")}
                          </TableHead>
                          <TableHead className="text-center w-16 min-w-[4.5rem] shrink-0">
                            {t("pos.products.table.action")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-10"
                            >
                              {t("pos.products.loading")}
                            </TableCell>
                          </TableRow>
                        ) : products?.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-10 text-muted-foreground"
                            >
                              {t("pos.products.none")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          products?.map((product: any) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium min-w-0 align-top">
                                <div className="flex items-center gap-2 min-w-0 max-w-full">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 touch-target-sm"
                                        aria-label={t(
                                          "pos.products.viewDetailsAria",
                                          { name: product.name }
                                        )}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                                      <DialogHeader>
                                        <DialogTitle>
                                          {product.name}
                                        </DialogTitle>
                                        <DialogDescription className="sr-only">
                                          {t(
                                            "pos.products.detailsDescriptionSr"
                                          )}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="flex items-center justify-center">
                                        {(() => {
                                          const imgUrl =
                                            product.productImage ||
                                            product.imageUrl;
                                          const useImage =
                                            imgUrl &&
                                            !imgUrl.startsWith("blob:");
                                          return useImage ? (
                                            <img
                                              src={imgUrl}
                                              alt={product.name}
                                              width={300}
                                              height={300}
                                              className="rounded-md object-cover max-w-full h-auto"
                                              data-ai-hint={product.imageHint}
                                              loading="lazy"
                                              decoding="async"
                                              onError={(e) => {
                                                const target =
                                                  e.target as HTMLImageElement;
                                                target.style.display = "none";
                                                const initialsDiv =
                                                  target.nextElementSibling as HTMLElement;
                                                if (initialsDiv) {
                                                  initialsDiv.style.display =
                                                    "flex";
                                                }
                                              }}
                                            />
                                          ) : null;
                                        })()}
                                        <div
                                          className={`w-[300px] h-[300px] rounded-md bg-primary/10 flex items-center justify-center ${(product.productImage || product.imageUrl) && !(product.productImage || product.imageUrl)?.startsWith("blob:") ? "hidden" : ""}`}
                                          style={{
                                            display:
                                              (product.productImage ||
                                                product.imageUrl) &&
                                              !(
                                                product.productImage ||
                                                product.imageUrl
                                              )?.startsWith("blob:")
                                                ? "none"
                                                : "flex",
                                          }}
                                        >
                                          <span className="text-6xl font-bold text-primary">
                                            {getProductInitials(product.name)}
                                          </span>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <div className="flex flex-col min-w-0 w-full max-w-full flex-1">
                                    <span className="w-full min-w-0 whitespace-normal break-words leading-tight">
                                      {product.name}
                                    </span>
                                    <span className="mt-1 text-xs text-muted-foreground md:hidden leading-tight">
                                      {t("pos.products.stockMobile", {
                                        stock: product.stock ?? "-",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {product.stock ?? "-"}
                              </TableCell>
                              <TableCell>
                                R
                                {(typeof product.price === "number"
                                  ? product.price
                                  : parseFloat(product.price || 0)
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center px-2">
                                <Button
                                  size="icon"
                                  className="mx-auto h-10 w-10 min-h-[44px] touch-target"
                                  aria-label={t("pos.products.addAria", {
                                    name: product.name,
                                  })}
                                  title={t("pos.products.addAria", {
                                    name: product.name,
                                  })}
                                  onClick={() => {
                                    const currentQty =
                                      cart.get(product.id)?.quantity ?? 0;
                                    const stock = product.stock ?? null;
                                    if (
                                      typeof stock === "number" &&
                                      stock < currentQty + 1
                                    ) {
                                      setInsufficientStockPopup({
                                        open: true,
                                        titleKey: "stock",
                                        message: t("pos.stock.insufficient", {
                                          productName: product.name,
                                          stock: String(stock),
                                        }),
                                      });
                                      return;
                                    }
                                    addToCart(product);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
                {productsPagination.totalPages > 0 ? (
                  <div className="pt-3 border-t mt-2">
                    <Pagination
                      meta={productsPagination}
                      onPageChange={loadPage}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Cart Section — desktop only; mobile uses bottom sheet */}
          <div className="hidden lg:flex lg:col-span-1 xl:col-span-1 min-w-0 w-full min-h-[200px] lg:max-h-none lg:h-full min-h-0 flex-col order-2">
            <PosSalePanel {...salePanelProps} className="h-full" />
          </div>
        </div>
      </div>
      <PosMobileCartSheet
        open={mobileCartOpen}
        onOpenChange={setMobileCartOpen}
        itemCount={cartItemCount}
        amountToPay={amountToPay}
      >
        <PosSalePanel {...salePanelProps} className="h-full rounded-none" />
      </PosMobileCartSheet>
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("pos.customer.dialogTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("pos.customer.dialogDescriptionSr")}
            </DialogDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder={t("pos.customer.searchPlaceholder")}
                className="pl-10"
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
              />
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pos.customer.table.name")}</TableHead>
                  <TableHead>{t("pos.customer.table.phone")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer: Customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleCustomerSelect(customer.id)}
                  >
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.contact}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm">{t("pos.customer.select")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <PaymentModal
        isOpen={!!activePaymentMethod}
        onClose={() => setActivePaymentMethod(null)}
        method={activePaymentMethod}
        cartTotal={amountToPay}
        cartItems={cartItems}
        onCompleteSale={handleCompleteSale}
        customer={selectedCustomer}
        isLoading={isCompletingSale}
      />
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        customerId={selectedCustomerId}
        onApplyVoucher={handleApplyVoucher}
        cartTotal={cartSubtotal} // Pass subtotal before discount for validation
      />
      <ApplyDiscountModal
        isOpen={isApplyDiscountModalOpen}
        onClose={() => setIsApplyDiscountModalOpen(false)}
        cartSubtotal={cartSubtotal}
        onApply={handleApplyManualDiscount}
      />
      <CreditSaleModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        amount={amountToPay}
        creditLimit={creditLimit ?? undefined}
        onConfirmCredit={handleConfirmCreditSale}
        onAddCustomer={() => {
          setCustomerSearchTerm("");
          setCustomerDialogOpen(true);
        }}
        isLoading={isCompletingSale}
      />
      <ReceiptModal
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          setReceiptData(null);
        }}
        data={receiptData}
      />
      <AlertDialog
        open={isClearCartDialogOpen}
        onOpenChange={setIsClearCartDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pos.clearDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pos.clearDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pos.clearDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearCartAndResetCoupons}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("pos.clearDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={insufficientStockPopup.open}
        onOpenChange={(open) =>
          !open &&
          setInsufficientStockPopup((prev) => ({ ...prev, open: false }))
        }
      >
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {insufficientStockPopup.titleKey === "credit"
                ? t("pos.stock.dialogTitleCredit")
                : insufficientStockPopup.titleKey === "notice"
                  ? t("pos.alert.title")
                  : t("pos.stock.dialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {insufficientStockPopup.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() =>
                setInsufficientStockPopup((prev) => ({ ...prev, open: false }))
              }
            >
              {t("pos.stock.ok")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isBarcodeScannerOpen}
        onOpenChange={setIsBarcodeScannerOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("pos.barcode.scanTitle")}</DialogTitle>
            <DialogDescription>
              {t("pos.barcode.scanDescription")}
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner
            isOpen={isBarcodeScannerOpen}
            onScan={handleBarcodeScan}
            onClose={() => setIsBarcodeScannerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
