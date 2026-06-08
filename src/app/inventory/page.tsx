"use client";
import Image from "next/image";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { StockAdjustmentReason, Product, StockAdjustment } from "@/types";
import type { ApiProduct } from "@/types/catalogue";
import { useQueryClient } from "@tanstack/react-query";
import { useProducts, useCategories, productKeys } from "@/hooks/use-catalogue";
import { useStockAdjustments } from "@/hooks/use-stock-adjustments";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { mutationQueue } from "@/lib/mutation-queue";
import { executeMutation } from "@/lib/mutation-registry";
import {
  updateProductInDexie,
  updateProductStockInDexie,
} from "@/lib/entity-cache";
import { catalogueApi } from "@/lib/api/catalogue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { feedback } from "@/lib/feedback";
import { useSettings } from "@/components/settings-provider";
import { Search, History, Edit, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { getProductInitials } from "@/lib/utils/product-initials";
import { useTranslation } from "react-i18next";

const REASONS: StockAdjustmentReason[] = [
  "New stock received",
  "Returns",
  "Shrinkage",
  "Expansion",
  "Damages",
  "Expired",
];

const INVENTORY_REASON_LABEL_KEY: Record<StockAdjustmentReason, string> = {
  "New stock received": "newStockReceived",
  Returns: "returns",
  Shrinkage: "shrinkage",
  Expansion: "expansion",
  Damages: "damages",
  Expired: "expired",
};

const adjustmentSchema = z.object({
  reason: z
    .enum([
      "New stock received",
      "Returns",
      "Shrinkage",
      "Expansion",
      "Damages",
      "Expired",
    ])
    .optional(),
  quantityOrUpdated: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
});

export default function InventoryPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { currentStore } = settings;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  const {
    products: apiProducts,
    pagination: productsPagination,
    loading: productsLoading,
    setFilters: setProductFilters,
    refresh: refreshProducts,
    updateProduct,
    loadPage: loadProductsPage,
  } = useProducts(1, 1000, {
    storeIdForOffline: currentStore?.id ?? undefined,
  });
  const { categories: apiCategories, loading: categoriesLoading } =
    useCategories(1, 1000, {
      storeIdForOffline: currentStore?.id ?? undefined,
    });

  const allProducts = apiProducts || [];
  const categories = apiCategories || [];

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<
    ApiProduct | Product | null
  >(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(
    null
  );
  const [thresholdValue, setThresholdValue] = useState(0);

  const {
    adjustments: stockAdjustments,
    loading: adjustmentsLoading,
    createAdjustment,
    isCreating,
  } = useStockAdjustments({
    productId: selectedProduct?.id,
  });

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      reason: undefined,
      quantityOrUpdated: undefined,
      note: "",
    },
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = searchTerm.trim();
      setProductFilters((prev: { search?: string; categoryId?: string }) => ({
        ...prev,
        search: q ? q : undefined,
      }));
      loadProductsPage(1);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps -- loadProductsPage/setProductFilters are stable

  const categoriesFingerprint = useMemo(
    () =>
      (apiCategories ?? [])
        .map((c: { id: string; name: string }) => `${c.id}:${c.name}`)
        .join("|"),
    [apiCategories]
  );

  useEffect(() => {
    const categoryId =
      selectedCategory === "all"
        ? undefined
        : (apiCategories ?? []).find(
            (c: { name: string }) => c.name === selectedCategory
          )?.id;
    setProductFilters((prev: { search?: string; categoryId?: string }) => ({
      ...prev,
      categoryId: categoryId ? String(categoryId) : undefined,
    }));
    loadProductsPage(1);
  }, [selectedCategory, categoriesFingerprint]); // eslint-disable-line react-hooks/exhaustive-deps -- apiCategories read when fingerprint changes

  useEffect(() => {
    loadProductsPage(1);
  }, [showLowStockOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    if (!allProducts?.length) return [];
    if (!showLowStockOnly) return allProducts;
    return allProducts.filter((product: any) => {
      const lowTh = product.lowStockThreshold || 0;
      return (product.stock ?? 0) <= lowTh && lowTh > 0;
    });
  }, [allProducts, showLowStockOnly]);

  const getStockBadgeVariant = (stock: number, threshold?: number) => {
    if (threshold !== undefined && threshold > 0 && stock <= threshold)
      return "destructive";
    if (stock < 50) return "secondary";
    return "default";
  };

  const openAdjustmentDialog = (product: any) => {
    setSelectedProduct(product);
    form.reset({
      reason: undefined as any,
      quantityOrUpdated: undefined as any,
      note: "",
    });
    setAdjustmentDialogOpen(true);
  };

  const currentStock = selectedProduct?.stock ?? 0;
  const reason = form.watch("reason");
  const quantityOrUpdated = form.watch("quantityOrUpdated") ?? 0;

  const computedNewStock = useMemo(() => {
    if (reason == null || quantityOrUpdated == null) return null;
    const q = Number(quantityOrUpdated);
    switch (reason) {
      case "New stock received":
        return currentStock + q;
      case "Returns":
        return currentStock + q;
      case "Damages":
      case "Expired":
        return Math.max(0, currentStock - q);
      case "Shrinkage":
      case "Expansion":
        return q;
      default:
        return null;
    }
  }, [reason, quantityOrUpdated, currentStock]);

  const secondFieldLabel = useMemo(() => {
    switch (reason) {
      case "New stock received":
        return t("inventory.adjustDialog.field.quantityReceived");
      case "Returns":
        return t("inventory.adjustDialog.field.quantityReturned");
      case "Shrinkage":
        return t("inventory.adjustDialog.field.updatedStockShrinkage");
      case "Expansion":
        return t("inventory.adjustDialog.field.updatedStockExpansion");
      case "Damages":
        return t("inventory.adjustDialog.field.quantityDamaged");
      case "Expired":
        return t("inventory.adjustDialog.field.quantityExpired");
      default:
        return "";
    }
  }, [reason, t]);

  const translateReason = (r: string) => {
    const suffix = INVENTORY_REASON_LABEL_KEY[r as StockAdjustmentReason];
    return suffix ? t(`inventory.reason.${suffix}`) : r;
  };

  const showUpdatedStockAboveNotes =
    reason &&
    reason !== "Shrinkage" &&
    reason !== "Expansion" &&
    computedNewStock != null;

  const openHistoryDialog = (product: any) => {
    setSelectedProduct(product);
    setHistoryDialogOpen(true);
  };

  const handleAdjustmentSubmit = async (
    values: z.infer<typeof adjustmentSchema>
  ) => {
    if (!selectedProduct || !selectedProduct.id) return;
    if (!values.reason) {
      feedback.error(
        t("inventory.feedback.reasonRequiredTitle"),
        t("inventory.feedback.reasonRequiredDesc"),
        t("inventory.feedback.reasonRequiredHint")
      );
      return;
    }
    if (
      values.quantityOrUpdated === undefined ||
      values.quantityOrUpdated === null
    ) {
      feedback.error(
        t("inventory.feedback.quantityRequiredTitle"),
        t("inventory.feedback.quantityRequiredDesc"),
        t("inventory.feedback.quantityRequiredHint")
      );
      return;
    }
    const q = Number(values.quantityOrUpdated);
    const cur = currentStock;
    let newStock: number;
    switch (values.reason) {
      case "New stock received":
        newStock = cur + q;
        break;
      case "Returns":
        newStock = cur + q;
        break;
      case "Damages":
      case "Expired":
        newStock = Math.max(0, cur - q);
        break;
      case "Shrinkage":
        if (q >= cur) {
          feedback.error(
            t("inventory.feedback.invalidShrinkTitle"),
            t("inventory.feedback.invalidShrinkDesc"),
            t("inventory.feedback.invalidShrinkHint")
          );
          return;
        }
        newStock = q;
        break;
      case "Expansion":
        if (q <= cur) {
          feedback.error(
            t("inventory.feedback.invalidExpandTitle"),
            t("inventory.feedback.invalidExpandDesc"),
            t("inventory.feedback.invalidExpandHint")
          );
          return;
        }
        newStock = q;
        break;
      default:
        return;
    }
    if (newStock < 0) {
      feedback.error(
        t("inventory.feedback.negativeStockTitle"),
        t("inventory.feedback.negativeStockDesc"),
        t("inventory.feedback.negativeStockHint")
      );
      return;
    }

    let offlineRollback: { productId: string; previousStock: number } | null =
      null;
    try {
      if (isOnline) {
        await createAdjustment({
          productId: selectedProduct.id,
          newStock,
          reason: values.reason as StockAdjustmentReason,
          note: values.note,
        });

        await refreshProducts();

        feedback.success(
          t("inventory.feedback.stockUpdatedTitle"),
          t("inventory.feedback.stockUpdatedDesc", {
            name: selectedProduct.name,
          })
        );
      } else {
        const productId = String(selectedProduct.id);
        offlineRollback = { productId, previousStock: cur };

        await updateProductStockInDexie(productId, newStock);
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });

        const variables = {
          productId: selectedProduct.id!,
          newStock,
          reason: values.reason,
          note: values.note,
        };
        mutationQueue.add({
          mutationKey: ["stockAdjustments", "create"],
          mutationFn: () =>
            executeMutation(["stockAdjustments", "create"], variables),
          variables,
        });

        feedback.success(
          t("inventory.feedback.stockAdjustedTitle"),
          t("inventory.feedback.stockAdjustedDesc")
        );
      }
      setAdjustmentDialogOpen(false);
      setSelectedProduct(null);
    } catch (error: any) {
      if (offlineRollback) {
        const { productId, previousStock } = offlineRollback;
        await updateProductStockInDexie(productId, previousStock);
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      }
      feedback.fromError(
        error,
        t("inventory.feedback.adjustFailedTitle"),
        t("inventory.feedback.adjustFailedHint")
      );
    }
  };

  const handleThresholdUpdate = async (id: string) => {
    const normalizedThreshold = Number.isFinite(thresholdValue)
      ? Math.max(0, Math.trunc(thresholdValue))
      : 0;
    if (normalizedThreshold < 0) {
      feedback.error(
        t("inventory.feedback.invalidThresholdTitle"),
        t("inventory.feedback.invalidThresholdDesc"),
        t("inventory.feedback.invalidThresholdHint")
      );
      return;
    }

    const previousThreshold = Number(
      allProducts.find((p: any) => String(p.id) === String(id))
        ?.lowStockThreshold ?? 0
    );

    const applyThresholdToCaches = async (nextThreshold: number) => {
      await updateProductInDexie(id, { lowStockThreshold: nextThreshold });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    };

    try {
      await applyThresholdToCaches(normalizedThreshold);
      if (isOnline) {
        await updateProduct(id, { lowStockThreshold: normalizedThreshold });

        feedback.success(
          t("inventory.feedback.lowStockTriggerTitle"),
          t("inventory.feedback.lowStockTriggerDesc")
        );
      } else {
        mutationQueue.add({
          mutationKey: ["products", "update"],
          mutationFn: () =>
            catalogueApi.products.update(id, {
              lowStockThreshold: normalizedThreshold,
            } as any),
          variables: { id, data: { lowStockThreshold: normalizedThreshold } },
        });
        feedback.success(
          t("inventory.feedback.thresholdTitle"),
          t("inventory.feedback.thresholdDesc")
        );
      }
      setEditingThresholdId(null);
    } catch (error: any) {
      feedback.fromError(
        error,
        t("inventory.feedback.thresholdFailedTitle"),
        t("inventory.feedback.thresholdFailedHint")
      );
      await applyThresholdToCaches(previousThreshold);
    }
  };

  return (
    <div className="p-2 sm:p-4 overflow-y-auto h-full">
      <Card>
        <div className="sticky top-0 z-20 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl">
              {t("inventory.page.title")}
            </CardTitle>
            <CardDescription className="text-sm">
              {t("inventory.page.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t("inventory.search.placeholder")}
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue
                    placeholder={t("inventory.filter.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("inventory.filter.allCategories")}
                  </SelectItem>
                  {categories?.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Switch
                  id="low-stock-filter"
                  checked={showLowStockOnly}
                  onCheckedChange={setShowLowStockOnly}
                />
                <Label htmlFor="low-stock-filter">
                  {t("inventory.filter.lowStockOnly")}
                </Label>
              </div>
            </div>
          </CardContent>
        </div>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] hidden sm:table-cell">
                    {t("inventory.table.image")}
                  </TableHead>
                  <TableHead>{t("inventory.table.name")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("inventory.table.category")}
                  </TableHead>
                  <TableHead>{t("inventory.table.stock")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("inventory.table.lowStockTrigger")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("inventory.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      {t("inventory.table.loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  filteredProducts.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="hidden sm:table-cell">
                        {(product as any).productImage ||
                        (product as any).imageUrl ? (
                          <div className="relative w-10 h-10">
                            <Image
                              src={
                                (product as any).productImage ||
                                (product as any).imageUrl
                              }
                              alt={product.name}
                              width={40}
                              height={40}
                              className="rounded-md object-cover"
                              data-ai-hint={(product as any).imageHint}
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
                              {getProductInitials(product.name)}
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {getProductInitials(product.name)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground md:hidden">
                            <Badge variant="outline" className="mt-1 w-fit">
                              {(product as any).category?.name ||
                                (product as any).category ||
                                t("inventory.table.notApplicable")}
                            </Badge>
                          </span>
                          <span className="text-xs text-muted-foreground lg:hidden">
                            {t("inventory.table.thresholdMobile", {
                              value: (product as any).lowStockThreshold ?? 0,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">
                          {(product as any).category?.name ||
                            (product as any).category ||
                            t("inventory.table.notApplicable")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStockBadgeVariant(
                            product.stock ?? 0,
                            (product as any).lowStockThreshold
                          )}
                        >
                          {product.stock ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          {editingThresholdId === product.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-24 h-8"
                                value={thresholdValue}
                                onChange={(e) => {
                                  const parsed = Number(e.target.value);
                                  setThresholdValue(
                                    Number.isFinite(parsed) ? parsed : 0
                                  );
                                }}
                                onBlur={() =>
                                  handleThresholdUpdate(product.id!)
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  handleThresholdUpdate(product.id!)
                                }
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>
                                {(product as any).lowStockThreshold ?? 0}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 touch-target"
                                onClick={() => {
                                  setEditingThresholdId(product.id!);
                                  setThresholdValue(
                                    (product as any).lowStockThreshold ?? 0
                                  );
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col sm:flex-row items-end sm:justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] touch-target w-full sm:w-auto"
                            onClick={() => openAdjustmentDialog(product)}
                          >
                            {t("inventory.actions.adjustStock")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-[44px] touch-target w-full sm:w-auto"
                            onClick={() => openHistoryDialog(product)}
                          >
                            <History className="h-4 w-4 sm:mr-1" />{" "}
                            <span className="hidden sm:inline">
                              {t("inventory.actions.history")}
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      {t("inventory.table.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {productsPagination && productsPagination.total > 0 && (
            <div className="mt-4 border-t pt-4">
              <Pagination
                meta={productsPagination}
                onPageChange={loadProductsPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {t("inventory.adjustDialog.title", {
                name: selectedProduct?.name ?? "",
              })}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t("inventory.adjustDialog.currentStock", {
                count: currentStock,
              })}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleAdjustmentSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.adjustDialog.reason")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "inventory.adjustDialog.reasonPlaceholder"
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {translateReason(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {reason && (
                <FormField
                  control={form.control}
                  name="quantityOrUpdated"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{secondFieldLabel}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : e.target.value
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {showUpdatedStockAboveNotes && (
                <p className="text-sm font-medium text-muted-foreground">
                  {t("inventory.adjustDialog.updatedStock")}{" "}
                  <span className="text-foreground">{computedNewStock}</span>
                </p>
              )}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("inventory.adjustDialog.noteOptional")}
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                    disabled={isCreating}
                  >
                    {t("inventory.adjustDialog.cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="min-h-[44px] touch-target w-full sm:w-auto"
                  disabled={isCreating}
                >
                  {isCreating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isCreating
                    ? t("inventory.adjustDialog.saving")
                    : t("inventory.adjustDialog.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {t("inventory.historyDialog.title", {
                name: selectedProduct?.name ?? "",
              })}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inventory.history.table.date")}</TableHead>
                <TableHead>{t("inventory.history.table.reason")}</TableHead>
                <TableHead>{t("inventory.history.table.oldStock")}</TableHead>
                <TableHead>{t("inventory.history.table.newStock")}</TableHead>
                <TableHead>{t("inventory.history.table.change")}</TableHead>
                <TableHead>{t("inventory.history.table.note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustmentsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    {t("inventory.history.loading")}
                  </TableCell>
                </TableRow>
              ) : (
                stockAdjustments?.map((adj: StockAdjustment) => {
                  const change = adj.newStock - adj.oldStock;
                  const adjDate = adj.createdAt
                    ? new Date(adj.createdAt)
                    : new Date(adj.date || Date.now());
                  return (
                    <TableRow key={adj.id}>
                      <TableCell>{format(adjDate, "Pp")}</TableCell>
                      <TableCell>{translateReason(adj.reason)}</TableCell>
                      <TableCell>{adj.oldStock}</TableCell>
                      <TableCell>{adj.newStock}</TableCell>
                      <TableCell
                        className={
                          change > 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {change > 0 ? `+${change}` : change}
                      </TableCell>
                      <TableCell>{adj.note || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {(!stockAdjustments || stockAdjustments.length === 0) && (
            <p className="text-center text-muted-foreground py-8">
              {t("inventory.history.empty")}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
