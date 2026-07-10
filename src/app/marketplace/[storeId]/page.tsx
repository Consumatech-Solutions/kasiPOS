"use client";

import { use, useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

import type { Transaction, TransactionItem } from "@/types";
import type { ApiProduct } from "@/types/catalogue";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Minus,
  Trash2,
  User,
  Search,
  QrCode,
  LayoutGrid,
  List,
  ArrowLeft,
} from "lucide-react";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
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
import { useSettings } from "@/components/settings-provider";
import { useStoreCurrency } from "@/hooks/use-store-currency";
import { useCustomers } from "@/hooks/use-customers";
import { useProducts, useCategories } from "@/hooks/use-catalogue";
import { useMarketplaceOrders } from "@/hooks/use-marketplace-orders";
import { useMarketplaceStores } from "@/hooks/use-marketplace-stores";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { getProductInitials } from "@/lib/utils/product-initials";
import { CreateMarketplaceOrderDto } from "@/lib/api/marketplace-orders";

const quickAccessCategories = [
  "Bread",
  "Airtime",
  "Dairy",
  "Cigs",
  "Veg",
  "Cool Drinks",
  "Snacks",
  "Groceries",
  "Beverages",
  "Toiletries",
];

type PageProps = { params: Promise<{ storeId?: string }> };

export default function StorePosPage(props: PageProps) {
  const resolvedParams = use(props.params);
  const storeId = resolvedParams?.storeId
    ? String(resolvedParams.storeId)
    : null;
  const { settings } = useSettings();
  const { formatMoney } = useStoreCurrency();
  const { currentStore } = settings;
  const { isOnline } = useNetworkStatus();
  const { stores: marketplaceStores } = useMarketplaceStores({
    activeOnly: true,
    autoLoad: true,
  });

  const storeName = storeId
    ? marketplaceStores.find((s) => s.code === storeId)?.name || "Marketplace"
    : "Marketplace";

  const [cart, setCart] = useState<Map<string, TransactionItem>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryView, setCategoryView] = useState<"carousel" | "grid">(
    "carousel"
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [activePaymentMethod, setActivePaymentMethod] = useState<
    "Cash" | "Card" | "Mobile Money" | null
  >(null);

  const { categories: apiCategories, loading: categoriesLoading } =
    useCategories(1, 1000);
  const {
    products: apiProducts,
    loading: productsLoading,
    setFilters,
  } = useProducts(1, 1000);
  const {
    createOrder,
    loading: orderLoading,
    isCreating,
  } = useMarketplaceOrders({
    autoLoad: false,
  });

  const products = apiProducts;

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        const nextSearch = productSearch || undefined;
        if (prev.search === nextSearch) return prev;
        return { ...prev, search: nextSearch };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearch, setFilters]);

  useEffect(() => {
    const categoryId = activeCategory
      ? apiCategories.find((c) => c.name === activeCategory)?.id
      : undefined;
    setFilters((prev) => {
      if (prev.categoryId === categoryId) return prev;
      return { ...prev, categoryId };
    });
  }, [activeCategory, apiCategories, setFilters]);

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
  const allCustomers = allCustomersList || [];

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId || !allCustomers) return undefined;
    return allCustomers.find((c) => c.id === selectedCustomerId);
  }, [selectedCustomerId, allCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    return allCustomers.filter(
      (customer) =>
        customer.name
          .toLowerCase()
          .includes(customerSearchTerm.toLowerCase()) ||
        customer.contact?.includes(customerSearchTerm)
    );
  }, [allCustomers, customerSearchTerm]);

  const selectCategory = (category: string | null) => {
    setActiveCategory(category);
    setCategoryView("carousel");
  };

  const addToCart = (product: ApiProduct) => {
    const productId = product.id;
    if (!productId) return;
    const unitPrice =
      typeof product.price === "number"
        ? product.price
        : parseFloat(String(product.price)) || 0;
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const existingItem = newCart.get(productId);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice =
          existingItem.quantity * existingItem.unitPrice;
      } else {
        newCart.set(productId, {
          productId: productId,
          productName: product.name,
          quantity: 1,
          unitPrice: unitPrice,
          totalPrice: unitPrice,
          imageUrl: product.productImage || undefined,
          stock: product.stock !== null ? product.stock : undefined,
        });
      }
      return newCart;
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart((prevCart) => {
      const newCart = new Map(prevCart);
      const item = newCart.get(productId);
      if (item) {
        if (newQuantity <= 0) {
          newCart.delete(productId);
        } else {
          item.quantity = newQuantity;
          item.totalPrice = item.quantity * item.unitPrice;
        }
      }
      return newCart;
    });
  };

  const cartItems = Array.from(cart.values());
  const cartSubtotal = cartItems.reduce(
    (acc, item) => acc + (Number(item.totalPrice) || 0),
    0
  );
  const vat = cartSubtotal * 0.15;
  const serviceFee = 15.0;
  const cartTotal = cartSubtotal + vat + serviceFee;

  const handleCheckout = (method: "Cash" | "Card" | "Mobile Money") => {
    if (cart.size === 0) {
      feedback.error(
        "Cart is empty",
        "Add products to the cart before checkout.",
        "Add items and try again.",
        { code: ERROR_CODES.MARKETPLACE_ORDER }
      );
      return;
    }
    if (!selectedCustomerId) {
      feedback.error(
        "No customer selected",
        "A customer is required for this marketplace order.",
        "Click Add Customer and select a customer.",
        { code: ERROR_CODES.MARKETPLACE_ORDER }
      );
      return;
    }
    setActivePaymentMethod(method);
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDialogOpen(false);
  };

  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
  const completingOrderRef = useRef(false);

  const handleCompleteSale = async (
    transactionDetails: Omit<Transaction, "id" | "date" | "storeId">
  ) => {
    if (completingOrderRef.current || isCompletingOrder) return;
    if (!currentStore || !storeId) {
      feedback.error(
        "Order failed",
        "Store context was not found.",
        "Refresh the page and try again.",
        { code: ERROR_CODES.MARKETPLACE_ORDER }
      );
      return;
    }

    if (!selectedCustomerId) {
      feedback.error(
        "Order failed",
        "No customer was selected.",
        "Select a customer and try again.",
        { code: ERROR_CODES.MARKETPLACE_ORDER }
      );
      return;
    }

    completingOrderRef.current = true;
    setIsCompletingOrder(true);
    try {
      const vat = cartSubtotal * 0.15;
      const serviceFee = 15.0;
      const total = cartSubtotal + vat + serviceFee;

      const orderData = {
        marketplaceStoreId: storeId,
        storeId: currentStore.id!,
        customerId: selectedCustomerId,
        items: cartItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          imageUrl: item.imageUrl,
        })),
        subtotal: cartSubtotal,
        vatAmount: vat,
        serviceFee: serviceFee,
        total: total,
        paymentMethod: transactionDetails.paymentMethod,
      };

      const response = await createOrder(
        orderData as CreateMarketplaceOrderDto
      );
      const createdOrder = response.data;

      feedback.success(
        "Order created",
        `Marketplace order ${createdOrder.orderCode} has been created successfully.`
      );

      setCart(new Map());
      setSelectedCustomerId(undefined);
      setActivePaymentMethod(null);
    } catch (error: unknown) {
      console.error("Failed to create order:", error);
    } finally {
      completingOrderRef.current = false;
      setIsCompletingOrder(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-4 h-full p-2 sm:p-4 bg-slate-50">
        <div className="lg:col-span-1 xl:col-span-3 bg-white rounded-lg p-2 sm:p-4 flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder={
                categoryView === "grid"
                  ? "Search categories..."
                  : "Scan barcode or search item..."
              }
              className="pl-10 h-12"
              value={categoryView === "grid" ? categorySearch : productSearch}
              onChange={(e) =>
                categoryView === "grid"
                  ? setCategorySearch(e.target.value)
                  : setProductSearch(e.target.value)
              }
            />
            <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>

          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Categories
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
              className="w-full mb-4"
            >
              <CarouselContent className="-ml-2">
                <CarouselItem className="basis-auto pl-2">
                  <Button
                    variant={activeCategory === null ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => selectCategory(null)}
                  >
                    All
                  </Button>
                </CarouselItem>
                {quickAccessCategories.map((cat) => (
                  <CarouselItem key={cat} className="basis-auto pl-2">
                    <Button
                      variant={activeCategory === cat ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        selectCategory(activeCategory === cat ? null : cat)
                      }
                    >
                      {cat}
                    </Button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2" />
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2" />
            </Carousel>
          ) : null}

          {categoryView === "grid" ? (
            <ScrollArea className="flex-grow pr-1">
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
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Products
              </p>
              <ScrollArea className="flex-grow pr-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] hidden sm:table-cell">
                        View
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Stock
                      </TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="hidden sm:table-cell">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="touch-target"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>{product.name}</DialogTitle>
                              </DialogHeader>
                              <div className="flex items-center justify-center">
                                {isOnline && product.productImage ? (
                                  <img
                                    src={product.productImage}
                                    alt={product.name}
                                    width={300}
                                    height={300}
                                    className="rounded-md object-cover max-w-full h-auto"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const initialsDiv =
                                        target.nextElementSibling as HTMLElement;
                                      if (initialsDiv) {
                                        initialsDiv.style.display = "flex";
                                      }
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`w-[300px] h-[300px] rounded-md bg-primary/10 flex items-center justify-center ${isOnline && product.productImage ? "hidden" : ""}`}
                                  style={{
                                    display:
                                      isOnline && product.productImage
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
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            <span className="text-xs text-muted-foreground md:hidden">
                              Stock: {product.stock}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {product.stock}
                        </TableCell>
                        <TableCell>
                          {formatMoney(
                            typeof product.price === "number"
                              ? product.price
                              : parseFloat(String(product.price)) || 0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="min-h-[44px] touch-target"
                            onClick={() => addToCart(product)}
                          >
                            <Plus className="h-4 w-4 sm:mr-2" />{" "}
                            <span className="hidden sm:inline">Add</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="lg:col-span-1 xl:col-span-2 bg-white rounded-lg flex flex-col h-full lg:sticky lg:top-16">
          <div className="p-2 sm:p-4 border-b shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 touch-target"
                  asChild
                >
                  <Link href="/marketplace">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to Marketplace</span>
                  </Link>
                </Button>
                <h2 className="font-semibold text-base sm:text-lg">
                  Order for {storeName}
                </h2>
              </div>
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
                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        placeholder="Search by name or phone number..."
                        className="pl-10"
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      />
                    </div>
                  </DialogHeader>
                  <div className="max-h-[50vh] overflow-y-auto overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers?.map((customer) => (
                          <TableRow
                            key={customer.id}
                            className="cursor-pointer hover:bg-muted"
                            onClick={() => handleCustomerSelect(customer.id)}
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
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div style={{ height: "35%" }}>
            <ScrollArea className="h-full">
              {cartItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-2 sm:gap-3 p-2 rounded-md hover:bg-gray-50"
                    >
                      {item.imageUrl ? (
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
                      <div className="flex-grow min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatMoney(Number(item.unitPrice) || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target"
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
                          className="h-9 w-9 sm:h-7 sm:w-7 rounded-full touch-target"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="font-semibold text-xs sm:text-sm w-16 sm:w-20 text-right">
                        {formatMoney(item.totalPrice)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-7 sm:w-7 text-gray-400 hover:text-red-500 touch-target"
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

          {cartItems.length > 0 && (
            <div className="pt-4 p-4 border-t" style={{ height: "65%" }}>
              <div className="text-sm space-y-2 mb-4">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatMoney(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>VAT (15%)</span>
                  <span>{formatMoney(vat)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Service Fee</span>
                  <span>{formatMoney(serviceFee)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 rounded-lg">
                <span className="text-lg font-bold">Total to Pay</span>
                <span className="text-2xl font-bold">
                  {formatMoney(cartTotal)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Button
                  size="lg"
                  className="h-12 sm:h-14 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white touch-target"
                  onClick={() => handleCheckout("Cash")}
                  disabled={!selectedCustomerId}
                >
                  CASH
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 sm:h-14 text-sm sm:text-base touch-target"
                  onClick={() => handleCheckout("Card")}
                  disabled={!selectedCustomerId}
                >
                  CARD
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 sm:h-14 text-sm sm:text-base touch-target"
                  onClick={() => handleCheckout("Mobile Money")}
                  disabled={!selectedCustomerId}
                >
                  MOBILE
                </Button>
              </div>
              {!selectedCustomerId && cartItems.length > 0 && (
                <p className="text-center text-sm text-destructive mt-2">
                  Please select a customer to proceed with the order.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={!!activePaymentMethod}
        onClose={() => setActivePaymentMethod(null)}
        method={activePaymentMethod}
        cartTotal={cartTotal}
        cartItems={cartItems}
        onCompleteSale={handleCompleteSale}
        customer={selectedCustomer}
        isLoading={isCompletingOrder || isCreating}
      />
    </>
  );
}
