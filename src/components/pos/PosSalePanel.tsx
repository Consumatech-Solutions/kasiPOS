"use client";

import Image from "next/image";
import type { TransactionItem, Customer } from "@/types";
import type { AppSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, Trash2, User, Ticket, Percent } from "lucide-react";
import { getProductInitials } from "@/lib/utils/product-initials";
import { useTranslation } from "react-i18next";
import { useStoreCurrency } from "@/hooks/use-store-currency";

const VAT_RATE = 15;

export type PosSalePanelProps = {
  cartItems: TransactionItem[];
  isCartHydrated: boolean;
  cartSubtotal: number;
  vatAmount: number;
  amountToPay: number;
  appliedDiscount: number;
  manualDiscountAmount: number;
  showVatInCheckout: boolean;
  settings: AppSettings;
  selectedCustomer?: Customer;
  campaignsEnabled: boolean;
  onOpenCustomerDialog: () => void;
  onOpenVoucherModal: () => void;
  onOpenDiscountModal: () => void;
  onCheckout: (method: "Cash" | "Card" | "Mobile Money" | "Credit") => void;
  onClearCart: () => void;
  updateQuantity: (productId: string, quantity: number) => void;
  onInsufficientStock: (message: string) => void;
  className?: string;
};

export function PosSalePanel({
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
  campaignsEnabled,
  onOpenCustomerDialog,
  onOpenVoucherModal,
  onOpenDiscountModal,
  onCheckout,
  onClearCart,
  updateQuantity,
  onInsufficientStock,
  className,
}: PosSalePanelProps) {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();

  return (
    <div
      data-testid="pos-sale-panel"
      className={`min-w-0 w-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-card rounded-lg p-2 sm:p-4 ${className ?? ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 border-b pb-3 shrink-0">
        <div>
          <h2 className="font-semibold text-base sm:text-lg">
            {t("pos.sale.title", { number: "8822" })}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] touch-target text-xs sm:text-sm"
            onClick={onOpenCustomerDialog}
          >
            <User className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              {selectedCustomer
                ? selectedCustomer.name
                : t("pos.customer.addButton")}
            </span>
          </Button>
          {campaignsEnabled && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] touch-target text-xs sm:text-sm"
              onClick={onOpenVoucherModal}
            >
              <Ticket className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">
                {t("pos.voucher.redeem")}
              </span>
              <span className="sm:hidden">{t("pos.voucher.short")}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] touch-target text-xs sm:text-sm"
            onClick={onOpenDiscountModal}
            disabled={cartItems.length === 0}
          >
            <Percent className="mr-1 sm:mr-2 h-4 w-4" />
            <span>{t("pos.discount.label")}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
        <ScrollArea className="h-full w-full min-w-0 pr-4">
          {!isCartHydrated ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <p>{t("pos.cart.loading")}</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>{t("pos.cart.empty")}</p>
            </div>
          ) : (
            <div className="space-y-1 w-full min-w-0">
              <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_5rem_8rem_5rem_2.75rem] gap-3 items-center px-2 py-1 text-xs text-muted-foreground text-left w-full min-w-0">
                <span className="min-w-0">{t("pos.cart.headers.product")}</span>
                <span className="shrink-0">{t("pos.cart.headers.price")}</span>
                <span className="shrink-0">{t("pos.cart.headers.qty")}</span>
                <span className="shrink-0">{t("pos.cart.headers.total")}</span>
                <span aria-hidden className="w-9 shrink-0" />
              </div>
              {cartItems.map((item) => {
                const unitPrice =
                  typeof item.unitPrice === "number"
                    ? item.unitPrice
                    : parseFloat(String(item.unitPrice)) || 0;
                const lineTotal =
                  typeof item.totalPrice === "number"
                    ? item.totalPrice
                    : parseFloat(String(item.totalPrice)) || 0;

                const productAvatar =
                  item.imageUrl && !item.imageUrl.startsWith("blob:") ? (
                    <div className="relative h-10 w-10 shrink-0">
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
                      <div className="hidden absolute inset-0 h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                        {getProductInitials(item.productName)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                      {getProductInitials(item.productName)}
                    </div>
                  );

                const qtyControls = (
                  <div className="flex items-center justify-start gap-1 sm:gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 rounded-full touch-target"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold sm:w-4">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 rounded-full touch-target"
                      onClick={() => {
                        const stock = item.stock;
                        if (
                          typeof stock === "number" &&
                          item.quantity + 1 > stock
                        ) {
                          onInsufficientStock(
                            t("pos.stock.insufficient", {
                              productName: item.productName,
                              stock: String(stock),
                            })
                          );
                          return;
                        }
                        updateQuantity(item.productId, item.quantity + 1);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                );

                const removeButton = (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 touch-target text-gray-400 hover:text-red-500 sm:h-7 sm:w-7"
                    onClick={() => updateQuantity(item.productId, 0)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                );

                return (
                  <div
                    key={item.productId}
                    data-testid="pos-cart-line"
                    data-product-name={item.productName}
                    className="w-full min-w-0 rounded-md p-2 hover:bg-gray-50 dark:hover:bg-muted/50 max-lg:flex max-lg:flex-col max-lg:gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_5rem_8rem_5rem_2.75rem] lg:items-start lg:gap-3"
                  >
                    <div className="flex min-w-0 w-full items-start gap-2 lg:col-span-1">
                      {productAvatar}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug break-words">
                          {item.productName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                          {formatMoney(unitPrice)}
                        </p>
                      </div>
                      <div className="shrink-0 lg:hidden">{removeButton}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 max-lg:w-full lg:contents">
                      <p className="hidden text-left text-sm text-muted-foreground lg:block lg:self-center">
                        {formatMoney(unitPrice)}
                      </p>
                      {qtyControls}
                      <p className="shrink-0 text-left text-sm font-semibold lg:self-center">
                        {formatMoney(lineTotal)}
                      </p>
                      <div className="hidden lg:block">{removeButton}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {cartItems.length > 0 ? (
        <div className="pt-4 border-t shrink-0">
          <div className="text-sm space-y-2 mb-4">
            <div className="flex justify-between text-gray-500">
              <span>{t("pos.cart.subtotal")}</span>
              <span>{formatMoney(cartSubtotal)}</span>
            </div>
            {showVatInCheckout && (
              <div className="flex justify-between text-gray-500">
                <span>{t("pos.cart.vatLine", { percent: VAT_RATE })}</span>
                <span>{formatMoney(vatAmount)}</span>
              </div>
            )}
            {(appliedDiscount > 0 || manualDiscountAmount > 0) && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>{t("pos.cart.discountApplied")}</span>
                <span>
                  -{formatMoney(appliedDiscount + manualDiscountAmount)}
                </span>
              </div>
            )}
          </div>
          <div className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {showVatInCheckout
              ? t("pos.cart.vatHintAdded")
              : t("pos.cart.vatHintInclusive")}
            {(settings.currentUser?.role === "admin" ||
              settings.currentStore?.ownerId === settings.currentUser?.id ||
              settings.currentUser?.role === "store_admin") && (
              <span className="block mt-1">
                <a
                  href="/settings#checkout-display-admin"
                  className="underline hover:text-foreground"
                >
                  {t("pos.cart.settingsLink")}
                </a>
              </span>
            )}
          </div>
          <div className="flex justify-between items-center mb-4 p-3 bg-gray-100 dark:bg-muted rounded-lg">
            <span className="text-lg font-bold">
              {t("pos.cart.totalToPay")}
            </span>
            <span className="text-2xl font-bold">
              {formatMoney(amountToPay)}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <Button
              size="lg"
              className="h-12 sm:h-14 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white touch-target"
              onClick={() => onCheckout("Cash")}
            >
              {t("pos.checkout.cash")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 sm:h-14 text-sm sm:text-base touch-target"
              onClick={() => onCheckout("Card")}
            >
              {t("pos.checkout.card")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 sm:h-14 text-sm sm:text-base touch-target"
              onClick={() => onCheckout("Mobile Money")}
            >
              {t("pos.checkout.mobile")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 sm:h-14 text-sm sm:text-base touch-target"
              onClick={() => onCheckout("Credit")}
            >
              {t("pos.checkout.credit")}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full bg-destructive/50 text-black hover:bg-destructive/10 hover:text-black mt-2"
            onClick={onClearCart}
          >
            {t("pos.cart.clear")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
