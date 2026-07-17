"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product } from "@/types";
import type { ApiProduct, ApiCategory } from "@/types/catalogue";
import { feedback } from "@/lib/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/components/settings-provider";
import {
  useCategories,
  useProducts,
  productKeys,
  categoryKeys,
} from "@/hooks/use-catalogue";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { mutationQueue } from "@/lib/mutation-queue";
import {
  saveCategoriesToDexie,
  updateCategoryInDexie,
  deleteCategoryFromDexie,
  updateProductInDexie,
  deleteProductFromDexie,
} from "@/lib/entity-cache";
import { executeMutation } from "@/lib/mutation-registry";
import { catalogueApi } from "@/lib/api/catalogue";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  MoreVertical,
  QrCode,
  Layers,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarcodeDisplay } from "@/components/barcode-display";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Pagination } from "@/components/ui/pagination";
import { ImageUpload } from "@/components/catalogue/image-upload";
import { ProductImage } from "@/components/catalogue/product-image";
import { AddTemplatesModal } from "@/components/catalogue/add-templates-modal";
import { useTranslation } from "react-i18next";
import { useStoreCurrency } from "@/hooks/use-store-currency";

const categorySchema = z.object({
  name: z
    .string()
    .min(2, { message: "Category name must be at least 2 characters." }),
});

const productSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Product name must be at least 2 characters." }),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number." }),
  costPrice: z.coerce
    .number()
    .min(0, { message: "Cost price can't be negative." }),
  stock: z.coerce
    .number()
    .int()
    .min(0, { message: "Stock can't be negative." })
    .optional(),
  lowStockThreshold: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number()
      .int()
      .min(0, { message: "Low stock trigger can't be negative." })
      .optional()
  ),
  category: z.string().min(1, { message: "Please select a category." }),
  barcode: z.string().optional(),
  imageUrl: z.string().optional(),
  imageHint: z.string().optional(),
});

export default function CataloguePage() {
  const { t } = useTranslation();
  const { formatMoney } = useStoreCurrency();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    ApiProduct | Product | null
  >(null);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(
    null
  );
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null
  );
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(
    null
  );
  const [activeCatalogueTab, setActiveCatalogueTab] =
    useState<string>("products");
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [addTemplatesOpen, setAddTemplatesOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "product" | "category";
    id: string;
  } | null>(null);
  const [duplicateNameModal, setDuplicateNameModal] = useState<{
    type: "product" | "category";
  } | null>(null);
  const productSubmitRef = useRef(false);
  const categorySubmitRef = useRef(false);

  const openDeleteConfirm = useCallback(
    (type: "product" | "category", id: string) => {
      (document.activeElement as HTMLElement)?.blur();
      setTimeout(() => setDeleteConfirm({ type, id }), 0);
    },
    []
  );

  const { settings } = useSettings();
  const {
    categories,
    pagination: categoriesPagination,
    loading: categoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory: deleteCategoryHook,
    loadPage: loadCategoriesPage,
    refresh: refreshCategories,
    isCreating: isCreatingCategory,
    isUpdating: isUpdatingCategory,
    isDeleting: isDeletingCategory,
  } = useCategories(1, 1000, {
    storeIdForOffline: settings?.currentStore?.id ?? undefined,
  });
  const typedCategories: ApiCategory[] = categories || [];
  const {
    products,
    pagination: productsPagination,
    loading: productsLoading,
    createProduct,
    updateProduct,
    deleteProduct: deleteProductHook,
    loadPage: loadProductsPage,
    setFilters: setProductFilters,
    refresh: refreshProducts,
    isCreating: isCreatingProduct,
    isUpdating: isUpdatingProduct,
    isDeleting: isDeletingProduct,
  } = useProducts(1, 1000, {
    storeIdForOffline: settings?.currentStore?.id ?? undefined,
  });
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProductCategoryId, setSelectedProductCategoryId] =
    useState<string>("all");
  const [productNameSortOrder, setProductNameSortOrder] = useState<
    "asc" | "desc"
  >("asc");
  const sortedProducts = useMemo(() => {
    const rows = [...(products ?? [])];
    rows.sort((a, b) => {
      const an = String(a.name ?? "").toLocaleLowerCase();
      const bn = String(b.name ?? "").toLocaleLowerCase();
      return productNameSortOrder === "asc"
        ? an.localeCompare(bn)
        : bn.localeCompare(an);
    });
    return rows;
  }, [products, productNameSortOrder]);

  const updateProductRef = useRef(updateProduct);
  updateProductRef.current = updateProduct;

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setProductFilters((prev) => ({
        ...prev,
        search: productSearchTerm.trim() || undefined,
        categoryId:
          selectedProductCategoryId === "all"
            ? undefined
            : selectedProductCategoryId,
      }));
      loadProductsPage(1);
    }, 250);
    return () => clearTimeout(debounceTimer);
  }, [
    productSearchTerm,
    selectedProductCategoryId,
    setProductFilters,
    loadProductsPage,
  ]);

  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      costPrice: 0,
      stock: 0,
      lowStockThreshold: undefined,
      category: "",
      barcode: "",
      imageUrl: "",
      imageHint: "",
    },
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  const openProductDialog = async (product?: ApiProduct | Product) => {
    productForm.reset();
    if (product) {
      setEditingProduct(product);

      const p = product as any;
      const name = p.name || "";
      const price = p.price || 0;
      const costPrice = p.costPrice || 0;
      const stock = p.stock || 0;
      const lowStockThreshold = p.lowStockThreshold ?? undefined;
      const categoryName =
        typeof p.category === "object" ? p.category.name : p.category || "";
      const barcodeValue = p.barCode || p.barcode || "";
      const imageUrl = p.productImage || p.imageUrl || "";
      const imageHint = p.imageHint || "";

      productForm.setValue("name", name);
      productForm.setValue("price", price);
      productForm.setValue("costPrice", costPrice);
      productForm.setValue("stock", stock);
      productForm.setValue("lowStockThreshold", lowStockThreshold);
      productForm.setValue("category", categoryName);
      productForm.setValue("barcode", barcodeValue);
      productForm.setValue("imageUrl", imageUrl);
      productForm.setValue("imageHint", imageHint);

      setProductImageUrl(imageUrl || null);
    } else {
      setEditingProduct(null);
      productForm.setValue("name", "");
      productForm.setValue("price", 0);
      productForm.setValue("costPrice", 0);
      productForm.setValue("stock", 0);
      productForm.setValue("lowStockThreshold", undefined);
      productForm.setValue("category", "");
      productForm.setValue("barcode", "");
      productForm.setValue("imageUrl", "");
      productForm.setValue("imageHint", "");
      setProductImageUrl(null);
    }
    setProductDialogOpen(true);
  };

  const handleProductSubmit = async (values: z.infer<typeof productSchema>) => {
    if (productSubmitRef.current || isCreatingProduct || isUpdatingProduct)
      return;
    productSubmitRef.current = true;
    try {
      const imageUrl = productImageUrl || values.imageUrl || "";

      const barCode = (values.barcode ?? "").trim() || undefined;

      const productData = {
        name: values.name,
        price: values.price,
        costPrice: values.costPrice,
        stock: values.stock || 0,
        lowStockThreshold: values.lowStockThreshold,
        category: values.category,
        barCode: barCode,
        imageUrl: imageUrl,
        imageHint: values.imageHint || "",
      };

      if (editingProduct && editingProduct.id) {
        if (isOnline) {
          await updateProduct(String(editingProduct.id), productData);
          feedback.success(
            t("catalogue.feedback.productUpdatedTitle"),
            t("catalogue.feedback.productUpdatedDesc")
          );
        } else {
          const productId = String(editingProduct.id);
          const optimisticUpdates = {
            name: productData.name,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock,
            ...(productData.lowStockThreshold != null
              ? { lowStockThreshold: productData.lowStockThreshold }
              : {}),
            barCode: productData.barCode ?? null,
            productImage: productData.imageUrl ?? null,
            category: productData.category,
            updatedAt: new Date().toISOString(),
          };
          const productQueries = queryClient.getQueriesData<{
            data: any[];
            meta: any;
          }>({ queryKey: productKeys.lists() });
          productQueries.forEach(([queryKey, data]) => {
            if (data?.data) {
              queryClient.setQueryData(queryKey, {
                ...data,
                data: data.data.map((p: any) =>
                  String(p.id) === productId
                    ? { ...p, ...optimisticUpdates }
                    : p
                ),
              });
            }
          });
          await updateProductInDexie(productId, {
            ...optimisticUpdates,
            category: {
              id: optimisticUpdates.category,
              name: optimisticUpdates.category,
            },
          });
          mutationQueue.add({
            mutationKey: ["products", "update"],
            mutationFn: () =>
              catalogueApi.products.update(productId, productData),
            variables: { id: editingProduct.id, data: productData },
          });
          feedback.success(
            t("catalogue.feedback.productUpdatedTitle"),
            t("catalogue.feedback.productUpdatedDesc")
          );
        }
      } else {
        const nameLower = (values.name ?? "").toString().trim().toLowerCase();
        const productExists = (products ?? []).some(
          (p: { name?: string }) =>
            (p.name ?? "").toString().trim().toLowerCase() === nameLower
        );
        if (productExists) {
          setDuplicateNameModal({ type: "product" });
          return;
        }
        if (isOnline) {
          await createProduct(productData as any);
          feedback.success(
            t("catalogue.feedback.productAddedTitle"),
            t("catalogue.feedback.productAddedDesc")
          );
          refreshProducts();
        } else {
          const tempId = `temp-${Date.now()}`;
          const selectedCategory = typedCategories.find(
            (c) => c.name === productData.category
          );
          const optimisticProduct = {
            id: tempId,
            name: productData.name,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock ?? null,
            ...(productData.lowStockThreshold != null
              ? { lowStockThreshold: productData.lowStockThreshold }
              : {}),
            barCode: productData.barCode ?? null,
            productImage: productData.imageUrl ?? null,
            categoryId: selectedCategory?.id ?? "",
            category: productData.category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          queryClient.setQueryData(
            productKeys.lists(),
            (old: { data: any[]; meta: any } | undefined) => {
              if (!old)
                return {
                  data: [optimisticProduct],
                  meta: { total: 1, page: 1, limit: 1000, totalPages: 1 },
                };
              return {
                ...old,
                data: [optimisticProduct, ...old.data],
                meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
              };
            }
          );
          queryClient.setQueryData(
            productKeys.list({
              page: 1,
              limit: 1000,
              storeIdForOffline: settings?.currentStore?.id ?? undefined,
            }),
            (old: { data: any[]; meta: any } | undefined) => {
              if (!old)
                return {
                  data: [optimisticProduct],
                  meta: { total: 1, page: 1, limit: 1000, totalPages: 1 },
                };
              return {
                ...old,
                data: [optimisticProduct, ...old.data],
                meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
              };
            }
          );
          const { getDb } = await import("@/lib/db");
          const sid = settings?.currentStore?.id;
          await getDb().productCache.put({
            ...optimisticProduct,
            createdAt: optimisticProduct.createdAt,
            ...(sid != null && sid !== "" ? { storeId: String(sid) } : {}),
          });
          mutationQueue.add({
            mutationKey: ["products", "create"],
            mutationFn: () =>
              executeMutation(["products", "create"], {
                ...productData,
                _tempId: tempId,
              }),
            variables: { ...productData, _tempId: tempId },
          });
          feedback.success(
            t("catalogue.feedback.productAddedTitle"),
            t("catalogue.feedback.productAddedDesc")
          );
        }
      }
      setProductDialogOpen(false);
      productForm.reset();
      setProductImageUrl(null);
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("catalogue.feedback.productSaveFailedTitle"),
        t("catalogue.feedback.productSaveFailedHint")
      );
    } finally {
      productSubmitRef.current = false;
    }
  };

  const handleDeleteProduct = async (id: string | number) => {
    setDeletingProductId(String(id));
    try {
      if (isOnline) {
        await deleteProductHook(String(id));
        feedback.success(
          t("catalogue.feedback.productDeletedTitle"),
          t("catalogue.feedback.productDeletedDesc")
        );
      } else {
        const productId = String(id);
        const productQueries = queryClient.getQueriesData<{
          data: any[];
          meta: any;
        }>({ queryKey: productKeys.lists() });
        productQueries.forEach(([queryKey, data]) => {
          if (data?.data) {
            queryClient.setQueryData(queryKey, {
              ...data,
              data: data.data.filter((p: any) => String(p.id) !== productId),
              meta: {
                ...data.meta,
                total: Math.max(0, (data.meta?.total ?? 1) - 1),
              },
            });
          }
        });
        await deleteProductFromDexie(productId);
        mutationQueue.add({
          mutationKey: ["products", "delete"],
          mutationFn: () => catalogueApi.products.delete(productId),
          variables: { id },
        });
        feedback.success(
          t("catalogue.feedback.productDeletedTitle"),
          t("catalogue.feedback.productDeletedDesc")
        );
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        t("catalogue.feedback.productDeleteFailedTitle"),
        t("catalogue.feedback.productDeleteFailedHint")
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const openCategoryDialog = (category?: ApiCategory) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset(category);
    } else {
      setEditingCategory(null);
      categoryForm.reset({ name: "" });
    }
    setCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (
    values: z.infer<typeof categorySchema>
  ) => {
    if (categorySubmitRef.current || isCreatingCategory || isUpdatingCategory)
      return;
    categorySubmitRef.current = true;
    try {
      if (editingCategory && editingCategory.id) {
        await updateCategory(String(editingCategory.id), values);
        feedback.success(
          t("catalogue.feedback.categoryUpdatedTitle"),
          t("catalogue.feedback.categoryUpdatedDesc")
        );
      } else {
        const nameLower = (values.name ?? "").toString().trim().toLowerCase();
        const categoryExists = (typedCategories ?? []).some(
          (c: ApiCategory) =>
            (c.name ?? "").toString().trim().toLowerCase() === nameLower
        );
        if (categoryExists) {
          setDuplicateNameModal({ type: "category" });
          return;
        }
        await createCategory(values);
        feedback.success(
          t("catalogue.feedback.categoryAddedTitle"),
          t("catalogue.feedback.categoryAddedDesc")
        );
      }
      setCategoryDialogOpen(false);
      categoryForm.reset();
    } catch (error: unknown) {
      console.error("Failed to save category:", error);
      feedback.fromError(
        error,
        t("catalogue.feedback.categorySaveFailedTitle"),
        t("catalogue.feedback.categorySaveFailedHint")
      );
    } finally {
      categorySubmitRef.current = false;
    }
  };

  const handleDeleteCategory = async (id: string | number) => {
    setDeletingCategoryId(String(id));
    try {
      await deleteCategoryHook(String(id));
      feedback.success(
        t("catalogue.feedback.categoryDeletedTitle"),
        t("catalogue.feedback.categoryDeletedDesc")
      );
    } catch (error) {
      feedback.fromError(
        error,
        t("catalogue.feedback.categoryDeleteFailedTitle"),
        t("catalogue.feedback.categoryDeleteFailedHint")
      );
    } finally {
      setDeletingCategoryId(null);
    }
  };

  return (
    <div className="h-full p-2 sm:p-4 mb-16">
      <Card>
        <div className="sticky top-0 z-30 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
          <CardHeader className="space-y-1 p-4 pb-5 sm:p-6 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">
              {t("catalogue.page.title")}
            </CardTitle>
            <CardDescription className="text-sm">
              {t("catalogue.page.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-2 pt-1 sm:px-6 sm:pb-3 sm:pt-2">
            <Tabs
              value={activeCatalogueTab}
              onValueChange={setActiveCatalogueTab}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 sm:gap-3">
                <TabsList>
                  <TabsTrigger value="products">
                    {t("catalogue.tabs.products")}
                  </TabsTrigger>
                  <TabsTrigger value="categories">
                    {t("catalogue.tabs.categories")}
                  </TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-2 order-first sm:order-none">
                  {activeCatalogueTab === "products" ? (
                    <Button
                      data-testid="catalogue-add-product-button"
                      onClick={() => openProductDialog()}
                      className="min-h-[44px] touch-target"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />{" "}
                      {t("catalogue.actions.addProduct")}
                    </Button>
                  ) : (
                    <Button
                      data-testid="catalogue-add-category-button"
                      onClick={() => openCategoryDialog()}
                      className="min-h-[44px] touch-target"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />{" "}
                      {t("catalogue.actions.addCategory")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => isOnline && setAddTemplatesOpen(true)}
                    className="min-h-[44px] touch-target"
                    disabled={!isOnline}
                    title={
                      !isOnline
                        ? t("catalogue.actions.templatesOfflineTitle")
                        : undefined
                    }
                  >
                    <Layers className="mr-2 h-4 w-4" />{" "}
                    {t("catalogue.actions.addTemplates")}
                  </Button>
                </div>
              </div>
            </Tabs>
          </CardContent>
        </div>
        <CardContent className="relative z-0 px-3 pb-3 pt-6 sm:px-4 sm:pb-4 sm:pt-8">
          <Tabs
            value={activeCatalogueTab}
            onValueChange={setActiveCatalogueTab}
          >
            {/* Products Tab */}
            <TabsContent
              value="products"
              className="mt-0 flex flex-col gap-4 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-2 md:gap-3">
                <Input
                  className="h-10"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  placeholder={t("catalogue.products.searchPlaceholder")}
                />
                <Select
                  value={selectedProductCategoryId}
                  onValueChange={setSelectedProductCategoryId}
                >
                  <SelectTrigger className="h-10 min-h-10 bg-background">
                    <SelectValue
                      placeholder={t("catalogue.products.filterPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("catalogue.products.allCategories")}
                    </SelectItem>
                    {typedCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative z-0 overflow-x-auto rounded-md border">
                <Table noScrollWrapper>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden sm:table-cell">
                        {t("catalogue.products.table.image")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium">
                        <button
                          type="button"
                          className="-mx-2 -my-1 inline-flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                          onClick={() =>
                            setProductNameSortOrder((prev) =>
                              prev === "asc" ? "desc" : "asc"
                            )
                          }
                        >
                          <span>{t("catalogue.products.table.name")}</span>
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-foreground"
                            aria-hidden
                          >
                            {productNameSortOrder === "asc" ? (
                              <ArrowDownAZ className="h-4 w-4" />
                            ) : (
                              <ArrowUpAZ className="h-4 w-4" />
                            )}
                            <span className="text-xs font-semibold tracking-wide">
                              {productNameSortOrder === "asc"
                                ? t("catalogue.products.sort.labelAz")
                                : t("catalogue.products.sort.labelZa")}
                            </span>
                          </span>
                          <span className="sr-only">
                            {t("catalogue.products.sort.sr", {
                              order:
                                productNameSortOrder === "asc"
                                  ? t("catalogue.products.sort.orderAz")
                                  : t("catalogue.products.sort.orderZa"),
                            })}
                          </span>
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden md:table-cell">
                        {t("catalogue.products.table.category")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium">
                        {t("catalogue.products.table.price")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden md:table-cell">
                        {t("catalogue.products.table.costPrice")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden sm:table-cell">
                        {t("catalogue.products.table.stock")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden md:table-cell">
                        {t("catalogue.products.table.lowStockTrigger")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium text-right">
                        {t("catalogue.products.table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">
                          {t("catalogue.products.loading")}
                        </TableCell>
                      </TableRow>
                    ) : sortedProducts.length > 0 ? (
                      sortedProducts.map((p) => {
                        const price =
                          typeof p.price === "number"
                            ? p.price
                            : parseFloat(String(p.price)) || 0;
                        const costPrice =
                          typeof p.costPrice === "number"
                            ? p.costPrice
                            : parseFloat(String(p.costPrice)) || 0;

                        return (
                          <TableRow key={`product-${p.id}`}>
                            <TableCell className="hidden sm:table-cell">
                              <ProductImage
                                productId={p.id}
                                imageUrl={p.productImage || (p as any).imageUrl}
                                alt={p.name}
                                width={40}
                                height={40}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-muted-foreground md:hidden">
                                  {(p.category as any)?.name ||
                                    (typeof p.category === "string"
                                      ? p.category
                                      : t("catalogue.products.noCategory"))}
                                </span>
                                <span className="text-xs text-muted-foreground sm:hidden">
                                  {t("catalogue.products.stockMobile", {
                                    stock: p.stock ?? 0,
                                  })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {(p.category as any)?.name ||
                                (typeof p.category === "string"
                                  ? p.category
                                  : t("catalogue.products.noCategory"))}
                            </TableCell>
                            <TableCell>{formatMoney(price)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {formatMoney(costPrice)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {p.stock}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {p.lowStockThreshold ?? "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="touch-target h-9 w-9"
                                    aria-label={t(
                                      "catalogue.products.table.actions"
                                    )}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="min-w-[10rem]"
                                >
                                  <DropdownMenuItem
                                    className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer"
                                    onSelect={() => {
                                      (
                                        document.activeElement as HTMLElement
                                      )?.blur();
                                      setTimeout(
                                        () => openProductDialog(p),
                                        50
                                      );
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    {t("catalogue.products.menu.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer text-destructive focus:text-destructive"
                                    onSelect={() => {
                                      (
                                        document.activeElement as HTMLElement
                                      )?.blur();
                                      setTimeout(
                                        () =>
                                          openDeleteConfirm(
                                            "product",
                                            String(p.id)
                                          ),
                                        50
                                      );
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t("catalogue.products.menu.delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-muted-foreground"
                        >
                          {t("catalogue.products.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {productsPagination && productsPagination.total > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Pagination
                    meta={productsPagination}
                    onPageChange={(page) => {
                      loadProductsPage(page);
                    }}
                  />
                </div>
              )}
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="flex flex-col mt-0">
              <div className="relative z-0 overflow-x-auto rounded-md border">
                <Table noScrollWrapper>
                  <TableHeader>
                    <TableRow className="border-b bg-card">
                      <TableHead className="sticky top-0 z-20 h-12 bg-card font-medium shadow-[0_1px_0_0_hsl(var(--border))]">
                        {t("catalogue.categories.table.name")}
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 h-12 bg-card font-medium text-right shadow-[0_1px_0_0_hsl(var(--border))]">
                        {t("catalogue.categories.table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center">
                          {t("catalogue.categories.loading")}
                        </TableCell>
                      </TableRow>
                    ) : typedCategories && typedCategories.length > 0 ? (
                      typedCategories.map((c: ApiCategory) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="touch-target h-9 w-9"
                                  aria-label={t(
                                    "catalogue.categories.table.actions"
                                  )}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-[10rem]"
                              >
                                <DropdownMenuItem
                                  className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer"
                                  onSelect={() => {
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
                                    setTimeout(() => openCategoryDialog(c), 50);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t("catalogue.products.menu.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer text-destructive focus:text-destructive"
                                  onSelect={() => {
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
                                    setTimeout(
                                      () =>
                                        openDeleteConfirm(
                                          "category",
                                          String(c.id)
                                        ),
                                      50
                                    );
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t("catalogue.products.menu.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground"
                        >
                          {t("catalogue.categories.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {categoriesPagination && categoriesPagination.total > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Pagination
                    meta={categoriesPagination}
                    onPageChange={(page) => {
                      loadCategoriesPage(page);
                    }}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            setProductImageUrl(null);
            productForm.reset();
          }
        }}
      >
        <DialogContent
          data-testid="catalogue-product-dialog"
          className="max-h-[90vh] w-full max-w-[95vw] flex flex-col sm:max-w-[425px]"
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            // Select content is portaled outside the dialog; without this, choosing a category dismisses the modal.
            if (
              target.closest("[data-radix-select-viewport]") ||
              target.closest('[role="listbox"]') ||
              target.closest("[data-radix-popper-content-wrapper]") ||
              target.closest('[data-state="open"][role="option"]') ||
              target.closest('[data-state="open"][role="listbox"]') ||
              target.closest('[role="presentation"]') ||
              target.getAttribute("role") === "option" ||
              target.getAttribute("role") === "listbox" ||
              target.getAttribute("role") === "presentation"
            ) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="flex-shrink-0 pr-8 sm:pr-10">
            <DialogTitle>
              {editingProduct
                ? t("catalogue.productDialog.titleEdit")
                : t("catalogue.productDialog.titleAdd")}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? t("catalogue.productDialog.descEdit")
                : t("catalogue.productDialog.descAdd")}
            </DialogDescription>
          </DialogHeader>
          {/* pl/pr inside scroll so input borders + focus rings (ring-offset) are not clipped */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4">
            <Form {...productForm}>
              <form
                onSubmit={productForm.handleSubmit(handleProductSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={productForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelName")}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelCategory")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "catalogue.productDialog.categoryPlaceholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {typedCategories
                            .filter(
                              (
                                c: ApiCategory,
                                index: number,
                                self: ApiCategory[]
                              ) =>
                                // Keep only the first occurrence of each category name
                                index ===
                                self.findIndex(
                                  (cat: ApiCategory) => cat.name === c.name
                                )
                            )
                            .map((c: ApiCategory, index: number) => (
                              <SelectItem
                                key={c.id ? String(c.id) : `category-${index}`}
                                value={c.name}
                              >
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelPrice")}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelCostPrice")}
                      </FormLabel>
                      <FormControl>
                        <Input required type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelStock")}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelLowStock")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelBarcode")}
                      </FormLabel>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t(
                                "catalogue.productDialog.barcodePlaceholder"
                              )}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsBarcodeScannerOpen(true)}
                            title={t(
                              "catalogue.productDialog.scanBarcodeTitle"
                            )}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                        {field.value && (
                          <div className="p-3 border rounded-md bg-background">
                            <BarcodeDisplay
                              value={field.value}
                              format={
                                field.value.length === 13 ? "EAN13" : "CODE128"
                              }
                              height={60}
                              width={2}
                            />
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalogue.productDialog.labelImage")}
                      </FormLabel>
                      <FormControl>
                        <ImageUpload
                          productId={editingProduct?.id || `temp-${Date.now()}`}
                          currentImageUrl={productImageUrl || field.value}
                          onUploadSuccess={(url) => {
                            setProductImageUrl(url);
                            field.onChange(url);
                          }}
                          onUploadError={(error) => {
                            feedback.error(
                              t("catalogue.upload.failedTitle"),
                              error,
                              t("catalogue.upload.failedHint")
                            );
                          }}
                          onDelete={() => {
                            setProductImageUrl(null);
                            field.onChange("");
                          }}
                          maxSizeMB={2}
                          disabled={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4 flex-col sm:flex-row gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] touch-target w-full sm:w-auto"
                disabled={isCreatingProduct || isUpdatingProduct}
              >
                {t("catalogue.productDialog.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="min-h-[44px] touch-target w-full sm:w-auto"
              onClick={productForm.handleSubmit(handleProductSubmit)}
              disabled={isCreatingProduct || isUpdatingProduct}
            >
              {(isCreatingProduct || isUpdatingProduct) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isCreatingProduct
                ? t("catalogue.productDialog.creating")
                : isUpdatingProduct
                  ? t("catalogue.productDialog.updating")
                  : t("catalogue.productDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
      >
        <DialogContent
          data-testid="catalogue-category-dialog"
          className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6"
        >
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editingCategory
                ? t("catalogue.categoryDialog.titleEdit")
                : t("catalogue.categoryDialog.titleAdd")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingCategory
                ? t("catalogue.categoryDialog.descEdit")
                : t("catalogue.categoryDialog.descAdd")}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form
              onSubmit={categoryForm.handleSubmit(handleCategorySubmit)}
              className="space-y-4"
            >
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("catalogue.categoryDialog.labelName")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    disabled={isCreatingCategory || isUpdatingCategory}
                  >
                    {t("catalogue.categoryDialog.cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="min-h-[44px] touch-target w-full sm:w-auto"
                  disabled={isCreatingCategory || isUpdatingCategory}
                >
                  {(isCreatingCategory || isUpdatingCategory) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isCreatingCategory
                    ? t("catalogue.categoryDialog.creating")
                    : isUpdatingCategory
                      ? t("catalogue.categoryDialog.updating")
                      : t("catalogue.categoryDialog.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!duplicateNameModal}
        onOpenChange={(open) => !open && setDuplicateNameModal(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {duplicateNameModal?.type === "product"
                ? t("catalogue.duplicate.productTitle")
                : t("catalogue.duplicate.categoryTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {duplicateNameModal?.type === "product"
                ? t("catalogue.duplicate.productDesc")
                : t("catalogue.duplicate.categoryDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="min-h-[44px] touch-target"
              onClick={() => setDuplicateNameModal(null)}
            >
              {t("catalogue.duplicate.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBarcodeScannerOpen}
        onOpenChange={setIsBarcodeScannerOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("catalogue.barcode.title")}</DialogTitle>
            <DialogDescription>
              {t("catalogue.barcode.description")}
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner
            isOpen={isBarcodeScannerOpen}
            onScan={(barcode) => {
              productForm.setValue("barcode", barcode);
              setIsBarcodeScannerOpen(false);
            }}
            onClose={() => setIsBarcodeScannerOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AddTemplatesModal
        open={addTemplatesOpen}
        onOpenChange={setAddTemplatesOpen}
        onSuccess={() => {
          refreshProducts();
          refreshCategories();
        }}
      />

      {/* Single delete confirmation dialog (page-level to avoid unmount crash when list updates) */}
      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              {t("catalogue.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {deleteConfirm?.type === "product"
                ? t("catalogue.delete.productDesc")
                : t("catalogue.delete.categoryDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="min-h-[44px] touch-target w-full sm:w-auto"
              onClick={() => setDeleteConfirm(null)}
            >
              {t("catalogue.delete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px] touch-target w-full sm:w-auto text-destructive focus:ring-destructive"
              disabled={
                deleteConfirm?.type === "product"
                  ? deletingProductId === deleteConfirm?.id || isDeletingProduct
                  : deletingCategoryId === deleteConfirm?.id ||
                    isDeletingCategory
              }
              onClick={async () => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "product") {
                  await handleDeleteProduct(deleteConfirm.id);
                } else {
                  await handleDeleteCategory(deleteConfirm.id);
                }
                setDeleteConfirm(null);
              }}
            >
              {(deleteConfirm?.type === "product"
                ? deletingProductId === deleteConfirm?.id || isDeletingProduct
                : deletingCategoryId === deleteConfirm?.id ||
                  isDeletingCategory) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {(
                deleteConfirm?.type === "product"
                  ? deletingProductId === deleteConfirm?.id || isDeletingProduct
                  : deletingCategoryId === deleteConfirm?.id ||
                    isDeletingCategory
              )
                ? t("catalogue.delete.deleting")
                : t("catalogue.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
