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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Minus,
  Trash2,
  User,
  Ticket,
  Search,
  QrCode,
  CreditCard,
  LayoutGrid,
  List,
  Percent,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { cn } from "@/lib/utils";
import { useEnsureStore } from "@/hooks/use-ensure-store";
import { useCart } from "@/components/providers/cart-provider";
import { buildReceiptData as buildReceiptDataFromUtil } from "@/lib/receipt-utils";
import { updateProductStockInDexie } from "@/lib/entity-cache";
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

export default function PosPage() {
  const { settings } = useSettings();
  const { currentStore: settingsStore } = settings;
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
    "carousel",
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
  }>({ open: false, message: "" });
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);

  const clearCartAndResetCoupons = () => {
    clearCart();
    setAppliedDiscount(0);
    setAppliedVoucherCode(undefined);
    setManualDiscount(null);
    setIsClearCartDialogOpen(false);
  };

  // API Hooks
  const { categories: apiCategories, loading: categoriesLoading } =
    useCategories(1, 1000, {
      storeIdForOffline: settings?.currentStore?.id ?? undefined,
    });
  const {
    products: apiProducts,
    loading: productsLoading,
    setFilters,
  } = useProducts(1, 1000, {
    storeIdForOffline: settings?.currentStore?.id ?? undefined,
  });

  const products = apiProducts;

  // Memoize categoryId lookup to prevent infinite loops
  const categoryId = useMemo(() => {
    if (!activeCategory || !apiCategories) return undefined;
    return apiCategories.find((c) => c.name === activeCategory)?.id;
  }, [activeCategory, apiCategories]);

  // Track previous categoryId to prevent unnecessary updates
  const prevCategoryIdRef = useRef<string | undefined>(undefined);

  // Debounce search and update filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev: any) => ({ ...prev, search: productSearch }));
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update category filter only when categoryId actually changes
  useEffect(() => {
    if (categoryId !== prevCategoryIdRef.current) {
      prevCategoryIdRef.current = categoryId;
      setFilters((prev: any) => ({ ...prev, categoryId }));
    }
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCategories = useMemo(() => {
    if (!apiCategories) return [];
    return apiCategories.map((c) => c.name);
  }, [apiCategories]);

  const filteredCategories = useMemo(() => {
    if (!allCategories) return [];
    return allCategories.filter((c) =>
      c.toLowerCase().includes(categorySearch.toLowerCase()),
    );
  }, [allCategories, categorySearch]);

  // Use API hook for customers
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
        customer.contact?.includes(customerSearchTerm),
    );
  }, [customers, customerSearchTerm]);

  const selectCategory = (category: string | null) => {
    setActiveCategory(category);
    setCategoryView("carousel");
  };

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce(
    (acc, item) => acc + item.totalPrice,
    0,
  );
  const manualDiscountAmount = useMemo(() => {
    if (!manualDiscount) return 0;
    if (manualDiscount.discountType === "percentage") {
      return (
        Math.round(
          ((cartSubtotal * manualDiscount.discountAmount) / 100) * 100,
        ) / 100
      );
    }
    return Math.min(cartSubtotal, Math.max(0, manualDiscount.discountAmount));
  }, [manualDiscount, cartSubtotal]);
  const cartTotal = cartSubtotal - appliedDiscount - manualDiscountAmount;
  const VAT_RATE = 15;
  const showVatInCheckout = settings.showVatInCheckout !== false;
  // VAT on: add VAT to total (Total = Subtotal + VAT)
  // VAT off: VAT is included in the total (no addition)
  const vatAmount = showVatInCheckout ? cartTotal * (VAT_RATE / 100) : 0;
  const amountToPay = showVatInCheckout ? cartTotal + vatAmount : cartTotal;

  const handleOpenVoucherModal = () => {
    if (cartSubtotal < 5) {
      feedback.error(
        "Cannot redeem voucher",
        "You need a cart total of at least R5 to redeem a voucher.",
        "Add more items to the cart.",
      );
      return;
    }
    setIsVoucherModalOpen(true);
  };

  const creditConfigured = settings?.currentStore?.credit != null;

  const handleCheckout = (
    method: "Cash" | "Card" | "Mobile Money" | "Credit",
  ) => {
    if (cart.size === 0) {
      feedback.error(
        "Cart is empty",
        "Please add products to the cart before checkout.",
        "Add products and try again.",
      );
      return;
    }
    if (method === "Credit") {
      if (!creditConfigured) {
        feedback.error(
          "Credit not configured",
          "Set the customer credit limit in Store settings to allow sales on credit.",
          "Open Settings",
        );
        return;
      }
      setIsCreditModalOpen(true);
      return;
    }
    setActivePaymentMethod(method);
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
      "Voucher applied",
      `Discount of R${amount.toFixed(2)} applied.`,
    );
  };

  const handleApplyManualDiscount = (discount: TransactionDiscount) => {
    setManualDiscount(discount);
    const amount =
      discount.discountType === "percentage"
        ? (cartSubtotal * discount.discountAmount) / 100
        : discount.discountAmount;
    feedback.success(
      "Discount applied",
      `Discount of R${amount.toFixed(2)} applied.`,
    );
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDialogOpen(false);
  };

  const handleBarcodeScan = (barcode: string) => {
    // First, try to find product by barcode
    const productByBarcode = products?.find((p) => p.barCode === barcode);

    if (productByBarcode) {
      // Product found by barcode - add to cart
      const currentQty = cart.get(productByBarcode.id)?.quantity ?? 0;
      const stock = productByBarcode.stock ?? null;
      if (typeof stock === "number" && stock < currentQty + 1) {
        setInsufficientStockPopup({
          open: true,
          message: `Insufficient stock for "${productByBarcode.name}". Available stock: ${stock}.`,
        });
        return;
      }
      // Convert ApiProduct to Product format for addToCart
      const productForCart = {
        id: productByBarcode.id,
        name: productByBarcode.name,
        price: productByBarcode.price,
        costPrice: productByBarcode.costPrice,
        stock: productByBarcode.stock ?? 0,
        category: productByBarcode.category?.name || "",
        barCode: productByBarcode.barCode || undefined,
        imageUrl: productByBarcode.productImage || "",
        productImage: productByBarcode.productImage || undefined,
      } as Product;
      addToCart(productForCart);
      feedback.success(
        "Product added",
        `${productByBarcode.name} added to cart.`,
      );
    } else {
      // Product not found - set search term to barcode for user to see results
      setProductSearch(barcode);
      setCategoryView("carousel"); // Switch to product view
      feedback.success(
        "Barcode scanned",
        `No product found with barcode "${barcode}". Showing search results.`,
      );
    }
  };

  const [isCompletingSale, setIsCompletingSale] = useState(false);

  const handleCompleteSale = async (
    transactionDetails: Omit<Transaction, "id" | "date" | "storeId">,
  ) => {
    if (isCompletingSale) return;
    setIsCompletingSale(true);
    if (process.env.NODE_ENV === "development") {
      console.log("[Complete Sale] Started", {
        method: transactionDetails.paymentMethod,
        items: transactionDetails.items.length,
        total: transactionDetails.total,
      });
    }
    const currentStore = await ensureStore();
    if (!currentStore) {
      setIsCompletingSale(false);
      return;
    }
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
      total: amountToPay, // VAT on = cartTotal + VAT, VAT off = cartTotal
      storeId: currentStore.id!,
      idempotencyKey,
    };

    const toReceiptData = (saleId: string): ReceiptData =>
      buildReceiptDataFromUtil({
        storeName: currentStore.name,
        saleId,
        items: newTransaction.items,
        subtotal: cartTotal, // Ex-VAT subtotal when VAT on, otherwise same as total
        discountAmount: appliedDiscount + manualDiscountAmount,
        total: amountToPay,
        paymentMethod: newTransaction.paymentMethod,
        showVat: showVatInCheckout,
        voucherCode: appliedVoucherCode ?? null,
        timestamp: new Date(),
      });

    if (isOnline) {
      // ONLINE: Use API - backend will update stock. Resolve temp IDs before sending.
      try {
        const mappings = await getDb().syncIdMapping.toArray();
        const map = new Map(mappings.map((m) => [m.tempId, m.serverId]));
        const unresolvedProductIds = newTransaction.items
          .map((item) => String(item.productId))
          .filter((id) => id.startsWith("temp-") && !map.has(id));
        if (unresolvedProductIds.length > 0) {
          setIsCompletingSale(false);
          feedback.error(
            "Products still syncing",
            "Some products in your cart haven't finished syncing. Please wait a moment and try again.",
          );
          return;
        }
        const resolvedItems = newTransaction.items.map((item) => ({
          ...item,
          productId: map.get(String(item.productId)) ?? String(item.productId),
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
          },
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

        queryClient.invalidateQueries({
          queryKey: productKeys.lists(),
          refetchType: "all",
        });

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
        feedback.success("Sale complete!", "View your receipt below.");
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
            newTransaction?.storeId,
          );
          if (data)
            console.error(
              "[Complete Sale] Response data:",
              JSON.stringify(data),
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
          /credit.*not configured|not configured.*credit/i.test(messageForUser);
        const popupMessage = isStoreIdError
          ? "Store configuration error. Please sign out, sign in again, then try the sale. If it persists, contact support."
          : isCreditNotConfigured
            ? "Credit is not configured for this store. Open Settings → Customer credit, choose this store, and save the credit limit and term."
            : messageForUser ||
              "Something went wrong. Check the items and store.";
        if (showInPopup) {
          setInsufficientStockPopup({
            open: true,
            message: popupMessage,
          });
        } else {
          feedback.fromError(
            error,
            "Failed to complete the sale",
            messageForUser
              ? `${messageForUser} Try again or check your connection.`
              : "Check your connection and try again.",
          );
        }
      } finally {
        setIsCompletingSale(false);
      }
    } else {
      // OFFLINE: Optimistically update and queue for later sync
      const previousStockMap = new Map<string, number>();
      try {
        // Snapshot stock before optimistic decrement (for rollback if save/queue fails offline)
        const listQueriesSnapshot = queryClient.getQueriesData<{
          data: { id?: string; stock?: number | null }[];
        }>({ queryKey: productKeys.lists() });
        for (const item of newTransaction.items) {
          const pid = String(item.productId);
          if (previousStockMap.has(pid)) continue;
          let found: number | undefined;
          for (const [, data] of listQueriesSnapshot) {
            const row = data?.data?.find((p) => String(p.id) === pid);
            if (row) {
              found = row.stock ?? 0;
              break;
            }
          }
          previousStockMap.set(pid, found ?? 0);
        }

        // 1. Optimistic cache update FIRST (synchronous, immediate UI feedback)
        const productQueryKeys = queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey);
        const productQueries = productQueryKeys.filter(
          (key) => Array.isArray(key) && key[0] === "products",
        );

        // Update stock optimistically for all product queries
        productQueries.forEach((queryKey) => {
          queryClient.setQueryData<{ data: any[]; meta: any }>(
            queryKey,
            (old) => {
              if (!old || !old.data) return old;
              return {
                ...old,
                data: old.data.map((product) => {
                  const cartItem = newTransaction.items.find(
                    (item) => String(item.productId) === String(product.id),
                  );
                  if (cartItem) {
                    const currentStock = product.stock ?? 0;
                    const newStock = Math.max(
                      0,
                      currentStock - cartItem.quantity,
                    );
                    return { ...product, stock: newStock };
                  }
                  return product;
                }),
              };
            },
          );
        });

        // 2. Save transaction to local IndexedDB
        await db.transactions.add(newTransaction as Transaction);

        // 3. Queue the transaction for sync when back online
        mutationQueue.add({
          mutationKey: ["transactions", "create"],
          mutationFn: () =>
            transactionsApi.create(
              toCreateTransactionDto(
                newTransaction as Omit<Transaction, "id"> & {
                  items: Array<TransactionItem & { [k: string]: unknown }>;
                },
              ),
              { idempotencyKey },
            ),
          variables: newTransaction,
        });

        setIsCompletingSale(false);

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
          "Offline sale complete!",
          "Receipt saved. Will sync when back online.",
        );
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[Complete Sale] Failed (offline)", { error });
        }
        console.error("Failed to complete offline sale:", error);

        // Rollback optimistic cache + Dexie (invalidateQueries refetches and fails while offline)
        const queriesData = queryClient.getQueriesData<{
          data: { id?: string; stock?: number | null }[];
          meta?: unknown;
        }>({ queryKey: productKeys.lists() });
        queriesData.forEach(([queryKey, data]) => {
          if (!data?.data || !Array.isArray(data.data)) return;
          queryClient.setQueryData(queryKey, {
            ...data,
            data: data.data.map((product) => {
              const pid = String(product.id);
              if (!previousStockMap.has(pid)) return product;
              return { ...product, stock: previousStockMap.get(pid)! };
            }),
          });
        });
        const productQueryKeys = queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.queryKey);
        const nonListProductQueries = productQueryKeys.filter(
          (key) =>
            Array.isArray(key) &&
            key[0] === "products" &&
            !(key[1] === "list" || key.length < 2),
        );
        nonListProductQueries.forEach((queryKey) => {
          queryClient.setQueryData<{ data: any[]; meta: any }>(
            queryKey,
            (old) => {
              if (!old?.data) return old;
              return {
                ...old,
                data: old.data.map(
                  (product: { id?: string; stock?: number | null }) => {
                    const pid = String(product.id);
                    if (!previousStockMap.has(pid)) return product;
                    return { ...product, stock: previousStockMap.get(pid)! };
                  },
                ),
              };
            },
          );
        });

        for (const item of newTransaction.items) {
          const pid = String(item.productId);
          const prev = previousStockMap.get(pid);
          if (prev !== undefined) {
            await updateProductStockInDexie(pid, prev);
          }
        }

        feedback.fromError(
          error,
          "Failed to save the sale locally",
          "Try again or check storage.",
        );
        setIsCompletingSale(false);
      }
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full min-h-[85vh] lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col overflow-x-hidden pb-4">
      <div className="flex-1 lg:min-h-0 lg:overflow-hidden py-4 px-2 sm:px-4 bg-muted">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 min-h-[80vh] lg:min-h-0 lg:h-full min-w-0 w-full">
          {/* Product Selection — first column: fixed height on desktop, product list scrolls independently */}
          <div className="lg:col-span-1 xl:col-span-1 min-w-0 min-h-[200px] max-h-[75vh] sm:max-h-[80vh] lg:max-h-none lg:h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-card rounded-lg p-2 sm:p-4 order-1">
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder={
                  categoryView === "grid"
                    ? "Search categories..."
                    : "Scan barcode or search item..."
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
                title="Scan barcode"
              >
                <QrCode className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>

            <div className="flex justify-between items-center mb-2 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Categories
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 touch-target"
                onClick={() =>
                  setCategoryView((prev) =>
                    prev === "carousel" ? "grid" : "carousel",
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
                      All
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
                            activeCategory === cat.name ? null : cat.name,
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
                    <p className="font-semibold">All</p>
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
                  Products
                </p>
                <ScrollArea className="flex-1 min-h-0 min-w-0 w-full pr-1">
                  <div
                    className="w-full min-w-0"
                    data-testid="pos-product-table"
                  >
                    <Table noScrollWrapper className="w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-0">Product</TableHead>
                          <TableHead className="hidden md:table-cell w-16 shrink-0">
                            Stock
                          </TableHead>
                          <TableHead className="w-20 shrink-0">Price</TableHead>
                          <TableHead className="text-center w-16 min-w-[4.5rem] shrink-0">
                            Action
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
                              Loading products...
                            </TableCell>
                          </TableRow>
                        ) : products?.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-10 text-muted-foreground"
                            >
                              No products found.
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
                                        aria-label={`View ${product.name}`}
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
                                          Product details and image
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
                                      Stock: {product.stock ?? "-"}
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
                                  aria-label={`Add ${product.name}`}
                                  title={`Add ${product.name}`}
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
                                        message: `Insufficient stock for "${product.name}". Available: ${stock}.`,
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
              </div>
            )}
          </div>

          {/* Cart Section — second column: fixed height on desktop, cart items scroll independently */}
          <div className="lg:col-span-1 xl:col-span-1 min-w-0 w-full min-h-[200px] max-h-[65vh] sm:max-h-[70vh] lg:max-h-none lg:h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-card rounded-lg p-2 sm:p-4 order-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 border-b pb-3 shrink-0">
              <div>
                <h2 className="font-semibold text-base sm:text-lg">
                  Sale #8822
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Dialog
                  open={customerDialogOpen}
                  onOpenChange={setCustomerDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] touch-target text-xs sm:text-sm"
                      onClick={() => setCustomerSearchTerm("")}
                    >
                      <User className="mr-1 sm:mr-2 h-4 w-4" />
                      <span className="truncate max-w-[120px] sm:max-w-none">
                        {selectedCustomer
                          ? selectedCustomer.name
                          : "Add Customer"}
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle>Select a Customer</DialogTitle>
                      <DialogDescription className="sr-only">
                        Search and select a customer for this sale
                      </DialogDescription>
                      <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Search by name or phone number..."
                          className="pl-10"
                          value={customerSearchTerm}
                          onChange={(e) =>
                            setCustomerSearchTerm(e.target.value)
                          }
                        />
                      </div>
                    </DialogHeader>
                    <ScrollArea className="max-h-[50vh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCustomers?.map((customer: Customer) => (
                            <TableRow
                              key={customer.id}
                              className="cursor-pointer hover:bg-muted"
                              onClick={() => {
                                handleCustomerSelect(customer.id);
                              }}
                            >
                              <TableCell>{customer.name}</TableCell>
                              <TableCell>{customer.contact}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm">Select</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                {settings?.campaigns && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] touch-target text-xs sm:text-sm"
                    onClick={handleOpenVoucherModal}
                  >
                    <Ticket className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Redeem Voucher</span>
                    <span className="sm:hidden">Voucher</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] touch-target text-xs sm:text-sm"
                  onClick={() =>
                    cartItems.length > 0 && setIsApplyDiscountModalOpen(true)
                  }
                  disabled={cartItems.length === 0}
                >
                  <Percent className="mr-1 sm:mr-2 h-4 w-4" />
                  <span>Discount</span>
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
              <ScrollArea className="h-full w-full min-w-0 pr-4">
                {!isCartHydrated ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Loading cart…</p>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-1 w-full min-w-0">
                    {/* Column headers — product column grows to fill card width */}
                    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_4.5rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_5rem_8rem_5rem_2.75rem] gap-2 sm:gap-3 items-center px-2 py-1 text-xs text-muted-foreground text-left w-full min-w-0">
                      <span className="min-w-0">Product</span>
                      <span className="shrink-0">Price</span>
                      <span className="shrink-0">Qty</span>
                      <span className="shrink-0">Total</span>
                      <span aria-hidden className="w-9 shrink-0" />
                    </div>
                    {cartItems.map((item) => (
                      <div
                        key={item.productId}
                        data-testid="pos-cart-line"
                        data-product-name={item.productName}
                        className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_4.5rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_5rem_8rem_5rem_2.75rem] gap-2 sm:gap-3 items-start p-2 rounded-md hover:bg-gray-50 dark:hover:bg-muted/50 w-full min-w-0"
                      >
                        <div className="flex items-start gap-2 w-full min-w-0">
                          {item.imageUrl &&
                          !item.imageUrl.startsWith("blob:") ? (
                            <div className="relative w-10 h-10 flex-shrink-0">
                              <Image
                                src={item.imageUrl}
                                alt={item.productName}
                                width={40}
                                height={40}
                                className="rounded-md bg-gray-200 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const initialsDiv =
                                    target.nextElementSibling as HTMLElement;
                                  if (initialsDiv) {
                                    initialsDiv.style.display = "flex";
                                  }
                                }}
                              />
                              <div className="hidden w-10 h-10 rounded-md bg-primary/10 items-center justify-center text-primary font-bold text-sm absolute inset-0">
                                {getProductInitials(item.productName)}
                              </div>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-sm">
                              {getProductInitials(item.productName)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs sm:text-sm break-words whitespace-normal hyphens-auto">
                              {item.productName}
                            </p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              R{" "}
                              {(typeof item.unitPrice === "number"
                                ? item.unitPrice
                                : parseFloat(String(item.unitPrice)) || 0
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground text-left hidden sm:block self-center">
                          R{" "}
                          {(typeof item.unitPrice === "number"
                            ? item.unitPrice
                            : parseFloat(String(item.unitPrice)) || 0
                          ).toFixed(2)}
                        </p>
                        <div className="flex items-center justify-start gap-1 sm:gap-2 self-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target shrink-0"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-sm w-6 sm:w-4 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target shrink-0"
                            onClick={() => {
                              const stock = item.stock;
                              if (
                                typeof stock === "number" &&
                                item.quantity + 1 > stock
                              ) {
                                setInsufficientStockPopup({
                                  open: true,
                                  message: `Insufficient stock for "${item.productName}". Available: ${stock}.`,
                                });
                                return;
                              }
                              updateQuantity(item.productId, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="font-semibold text-xs sm:text-sm w-16 sm:w-20 text-left self-center">
                          R
                          {(typeof item.totalPrice === "number"
                            ? item.totalPrice
                            : parseFloat(String(item.totalPrice)) || 0
                          ).toFixed(2)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-7 sm:w-7 text-gray-400 hover:text-red-500 touch-target self-center"
                          onClick={() => updateQuantity(item.productId, 0)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {cartItems.length > 0 ? (
              <div className="pt-4 border-t shrink-0">
                <div className="text-sm space-y-2 mb-4">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>R {cartSubtotal.toFixed(2)}</span>
                  </div>
                  {showVatInCheckout && (
                    <div className="flex justify-between text-gray-500">
                      <span>VAT (15%)</span>
                      <span>R {vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {(appliedDiscount > 0 || manualDiscountAmount > 0) && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Discount Applied</span>
                      <span>
                        -R {(appliedDiscount + manualDiscountAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {showVatInCheckout
                    ? "VAT is added to the total. Total = Subtotal + VAT."
                    : "VAT is included in the total (no addition)."}
                  {(settings.currentUser?.role === "admin" ||
                    settings.currentStore?.ownerId ===
                      settings.currentUser?.id ||
                    settings.currentUser?.role === "store_admin") && (
                    <span className="block mt-1">
                      <a
                        href="/settings#checkout-display-admin"
                        className="underline hover:text-foreground"
                      >
                        Display options in Settings
                      </a>
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 dark:bg-muted rounded-lg">
                  <span className="text-lg font-bold">Total to Pay</span>
                  <span className="text-2xl font-bold">
                    R {amountToPay.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  <Button
                    size="lg"
                    className="h-12 sm:h-14 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white touch-target"
                    onClick={() => handleCheckout("Cash")}
                  >
                    CASH
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 sm:h-14 text-sm sm:text-base touch-target"
                    onClick={() => handleCheckout("Card")}
                  >
                    CARD
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 sm:h-14 text-sm sm:text-base touch-target"
                    onClick={() => handleCheckout("Mobile Money")}
                  >
                    MOBILE
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 sm:h-14 text-sm sm:text-base touch-target"
                    onClick={() => handleCheckout("Credit")}
                  >
                    CREDIT
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full bg-destructive/50 text-black hover:bg-destructive/10 hover:text-black mt-2"
                  onClick={() => setIsClearCartDialogOpen(true)}
                >
                  Clear cart
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
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
            <AlertDialogTitle>Clear cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all items from the cart and clear any applied
              voucher or discount. You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearCartAndResetCoupons}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear cart
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
              {insufficientStockPopup.message.toLowerCase().includes("credit")
                ? "Credit not configured"
                : "Insufficient stock"}
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
              OK
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
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>
              Use your camera or barcode scanner device to scan a product
              barcode.
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
