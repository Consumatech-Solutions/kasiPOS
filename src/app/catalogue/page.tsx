'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Product } from '@/types';
import type { ApiProduct, ApiCategory } from '@/types/catalogue';
import { feedback } from '@/lib/feedback';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories, useProducts, productKeys } from '@/hooks/use-catalogue';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { mutationQueue } from '@/lib/mutation-queue';
import { executeMutation } from '@/lib/mutation-registry';
import { catalogueApi } from '@/lib/api/catalogue';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, RefreshCw, Loader2, MoreVertical, QrCode } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarcodeDisplay } from '@/components/barcode-display';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { Pagination } from '@/components/ui/pagination';
import { ImageUpload } from '@/components/catalogue/image-upload';
import { ProductImage } from '@/components/catalogue/product-image';


// Zod Schemas for validation
const categorySchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
});

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const productSchema = z.object({
  name: z.string().min(2, { message: "Product name must be at least 2 characters." }),
  price: z.coerce.number().positive({ message: "Price must be a positive number." }),
  costPrice: z.coerce.number().min(0, { message: "Cost price can't be negative." }),
  stock: z.coerce.number().int().min(0, { message: "Stock can't be negative." }).optional(),
  category: z.string().min(1, { message: "Please select a category." }),
  barcode: z.string().optional(),
  imageUrl: z.string().optional(),
  imageHint: z.string().optional(),
});


export default function CataloguePage() {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [activeCatalogueTab, setActiveCatalogueTab] = useState<string>('products');
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  // Generate a unique barcode (EAN-13 format: 13 digits)
  const generateBarcode = (): string => {
    // Generate a 12-digit number (EAN-13 has 13 digits, last is check digit)
    const base = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit.toString();
  };


  // Hooks for data with sync and pagination
  const { categories, pagination: categoriesPagination, loading: categoriesLoading, createCategory, updateCategory, deleteCategory: deleteCategoryHook, loadPage: loadCategoriesPage, isCreating: isCreatingCategory, isUpdating: isUpdatingCategory, isDeleting: isDeletingCategory } = useCategories(1, 10);
  // Type assertion for callbacks
  const typedCategories: ApiCategory[] = categories || [];
  const { products, pagination: productsPagination, loading: productsLoading, createProduct, updateProduct, deleteProduct: deleteProductHook, loadPage: loadProductsPage, refresh: refreshProducts, isCreating: isCreatingProduct, isUpdating: isUpdatingProduct, isDeleting: isDeletingProduct } = useProducts(1, 10);

  // Auto-generate barcodes for products that don't have one (only once per product).
  // Depend only on product IDs + loading so we don't re-run when products array reference
  // changes after each updateProduct (invalidateQueries), which would cause an infinite loop.
  const processedProductsRef = useRef<Set<string | number>>(new Set());
  const isGeneratingRef = useRef(false);
  const updateProductRef = useRef(updateProduct);
  updateProductRef.current = updateProduct;

  const productIdsKey = (products ?? [])
    .map((p) => p.id)
    .filter(Boolean)
    .sort()
    .join(',');


  // Form Hooks
  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      price: 0,
      costPrice: 0,
      stock: 0,
      category: '',
      barcode: '',
      imageUrl: '',
      imageHint: '',
    },
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  // Handlers for Products
  const openProductDialog = async (product?: ApiProduct | Product) => {
    productForm.reset();
    if (product) {
      setEditingProduct(product);
      
      // Safe access to properties that differ between Product and ApiProduct
      const p = product as any;
      const name = p.name || '';
      const price = p.price || 0;
      const costPrice = p.costPrice || 0;
      const stock = p.stock || 0;
      const categoryName = typeof p.category === 'object' ? p.category.name : (p.category || '');
      const barcodeValue = p.barCode || p.barcode || '';
      const imageUrl = p.productImage || p.imageUrl || '';
      const imageHint = p.imageHint || '';

      productForm.setValue('name', name);
      productForm.setValue('price', price);
      productForm.setValue('costPrice', costPrice);
      productForm.setValue('stock', stock);
      productForm.setValue('category', categoryName);
      productForm.setValue('barcode', barcodeValue);
      productForm.setValue('imageUrl', imageUrl);
      productForm.setValue('imageHint', imageHint);
      
      // Utiliser uniquement l'URL distante
      setProductImageUrl(imageUrl || null);
    } else {
      setEditingProduct(null);
      productForm.setValue('name', '');
      productForm.setValue('price', 0);
      productForm.setValue('costPrice', 0);
      productForm.setValue('stock', 0);
      productForm.setValue('category', '');
      productForm.setValue('barcode', '');
      productForm.setValue('imageUrl', '');
      productForm.setValue('imageHint', '');
      setProductImageUrl(null);
    }
    setProductDialogOpen(true);
  };

  const handleProductSubmit = async (values: z.infer<typeof productSchema>) => {
    try {
      // Use the uploaded image URL if available, otherwise use the form value
      const imageUrl = productImageUrl || values.imageUrl || '';
      
      const barCode = (values.barcode ?? '').trim() || undefined;

      const productData = {
        name: values.name,
        price: values.price,
        costPrice: values.costPrice,
        stock: values.stock || 0,
        category: values.category,
        barCode: barCode,
        imageUrl: imageUrl,
        imageHint: values.imageHint || '',
      };

      if (editingProduct && editingProduct.id) {
        if (isOnline) {
          await updateProduct(String(editingProduct.id), productData);
          feedback.success('Product updated', 'Product updated successfully.');
        } else {
          // Offline: queue mutation (optimistic update already done by hook)
          mutationQueue.add({
            mutationKey: ['products', 'update'],
            mutationFn: () => catalogueApi.products.update(String(editingProduct.id), productData),
            variables: { id: editingProduct.id, data: productData },
          });
          feedback.success('Queued', 'Product update queued. Will sync when online.');
        }
      } else {
        if (isOnline) {
          await createProduct(productData as any);
          feedback.success('Product added', 'Product added successfully.');
          refreshProducts();
        } else {
          // Offline: optimistic update with temp id, then queue for sync (no custom mutationFn - registry will run on restore)
          const tempId = `temp-${Date.now()}`;
          const optimisticProduct = {
            id: tempId,
            name: productData.name,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock ?? null,
            barCode: productData.barCode ?? null,
            productImage: productData.imageUrl ?? null,
            categoryId: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          queryClient.setQueryData(productKeys.lists(), (old: { data: any[]; meta: any } | undefined) => {
            if (!old) return { data: [optimisticProduct], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
            return {
              ...old,
              data: [optimisticProduct, ...old.data],
              meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
            };
          });
          queryClient.setQueryData(productKeys.list({ page: 1, limit: 10 }), (old: { data: any[]; meta: any } | undefined) => {
            if (!old) return { data: [optimisticProduct], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
            return {
              ...old,
              data: [optimisticProduct, ...old.data],
              meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
            };
          });
          const { getDb } = await import('@/lib/db');
          await getDb().productCache.put({ ...optimisticProduct, createdAt: optimisticProduct.createdAt });
          mutationQueue.add({
            mutationKey: ['products', 'create'],
            mutationFn: () => executeMutation(['products', 'create'], { ...productData, _tempId: tempId }),
            variables: { ...productData, _tempId: tempId },
          });
          feedback.success('Queued', 'Product added. Will sync when online.');
        }
      }
      setProductDialogOpen(false);
      productForm.reset();
      setProductImageUrl(null);
    } catch (error) {
      console.error("Failed to save product:", error);
      feedback.fromError(error, 'Failed to save product', 'Check your connection and try again.');
    }
  };


  const handleDeleteProduct = async (id: string | number) => {
    setDeletingProductId(String(id));
    try {
      if (isOnline) {
        await deleteProductHook(String(id));
        feedback.success('Product deleted', 'Product deleted successfully.');
      } else {
        // Offline: queue mutation (optimistic update already done by hook)
        mutationQueue.add({
          mutationKey: ['products', 'delete'],
          mutationFn: () => catalogueApi.products.delete(String(id)),
          variables: { id },
        });
        feedback.success('Queued', 'Product deletion queued. Will sync when online.');
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
      feedback.fromError(error, 'Failed to delete product', 'Try again or check your connection.');
    } finally {
      setDeletingProductId(null);
    }
  };

  // Handlers for Categories
  const openCategoryDialog = (category?: ApiCategory) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset(category);
    } else {
      setEditingCategory(null);
      categoryForm.reset({ name: '' });
    }
    setCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (values: z.infer<typeof categorySchema>) => {
    try {
      if (editingCategory && editingCategory.id) {
        if (isOnline) {
          await updateCategory(String(editingCategory.id), values);
          feedback.success('Category updated', 'Category updated successfully.');
        } else {
          // Offline: queue mutation (optimistic update already done by hook)
          mutationQueue.add({
            mutationKey: ['categories', 'update'],
            mutationFn: () => catalogueApi.categories.update(String(editingCategory.id), values),
            variables: { id: editingCategory.id, data: values },
          });
          feedback.success('Queued', 'Category update queued. Will sync when online.');
        }
      } else {
        if (isOnline) {
          await createCategory(values);
          feedback.success('Category added', 'Category added successfully.');
        } else {
          // Offline: queue mutation (optimistic update already done by hook)
          mutationQueue.add({
            mutationKey: ['categories', 'create'],
            mutationFn: () => catalogueApi.categories.create(values),
            variables: values,
          });
          feedback.success('Queued', 'Category queued. Will sync when online.');
        }
      }
      setCategoryDialogOpen(false);
      categoryForm.reset();
    } catch (error) {
      console.error("Failed to save category:", error);
      feedback.fromError(error, 'Failed to save category', 'Check your connection and try again.');
    }
  };

  const handleDeleteCategory = async (id: string | number) => {
    setDeletingCategoryId(String(id));
    try {
      if (isOnline) {
        await deleteCategoryHook(String(id));
        feedback.success('Category deleted', 'Category deleted successfully.');
      } else {
        // Offline: queue mutation (optimistic update already done by hook)
        mutationQueue.add({
          mutationKey: ['categories', 'delete'],
          mutationFn: () => catalogueApi.categories.delete(String(id)),
          variables: { id },
        });
        feedback.success('Queued', 'Category deletion queued. Will sync when online.');
      }
      // Note: You might want to handle products in the deleted category.
    } catch (error) {
      console.error("Failed to delete category:", error);
      feedback.fromError(error, 'Failed to delete category', 'Try again or check your connection.');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  return (
    <div className="p-2 sm:p-4 overflow-y-auto h-full">
      <Card>
        <div className="sticky top-0 z-30 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl">Catalogue Management</CardTitle>
            <CardDescription className="text-sm">Manage your products and categories.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={activeCatalogueTab} onValueChange={setActiveCatalogueTab}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
                <TabsList>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>
                {activeCatalogueTab === 'products' ? (
                  <Button onClick={() => openProductDialog()} className="w-full sm:w-auto min-h-[44px] touch-target order-first sm:order-none">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                  </Button>
                ) : (
                  <Button onClick={() => openCategoryDialog()} className="w-full sm:w-auto min-h-[44px] touch-target order-first sm:order-none">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Category
                  </Button>
                )}
              </div>
            </Tabs>
          </CardContent>
        </div>
        <CardContent className="relative z-0">
          <Tabs value={activeCatalogueTab} onValueChange={setActiveCatalogueTab}>
            {/* Products Tab */}
            <TabsContent value="products" className="flex flex-col mt-0">
              <div className="border rounded-md overflow-auto overscroll-contain relative z-0" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <Table noScrollWrapper>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden sm:table-cell">Image</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium">Name</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden md:table-cell">Category</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium">Price</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden md:table-cell">Cost Price</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium hidden sm:table-cell">Stock</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] font-medium text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Loading products...</TableCell>
                  </TableRow>
                ) : products && products.length > 0 ? (
                  products.map(p => {
                    const price = typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0;
                    const costPrice = typeof p.costPrice === 'number' ? p.costPrice : parseFloat(String(p.costPrice)) || 0;
              
                    
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
                            {(p.category as any)?.name || (typeof p.category === 'string' ? p.category : 'No Category')}
                          </span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            Stock: {p.stock ?? 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{(p.category as any)?.name || (typeof p.category === 'string' ? p.category : 'No Category')}</TableCell>
                      <TableCell>R{price.toFixed(2)}</TableCell>
                      <TableCell className="hidden md:table-cell">R{costPrice.toFixed(2)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.stock}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="touch-target h-9 w-9" aria-label="Actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[10rem]">
                            <DropdownMenuItem className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer" onClick={() => openProductDialog(p)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg sm:text-xl">Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm">
                                    This action cannot be undone. This will permanently delete the product.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                  <AlertDialogCancel className="min-h-[44px] touch-target w-full sm:w-auto" disabled={deletingProductId === p.id || isDeletingProduct}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => handleDeleteProduct(p.id!)} disabled={deletingProductId === p.id || isDeletingProduct}>
                                    {(deletingProductId === p.id || isDeletingProduct) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {deletingProductId === p.id || isDeletingProduct ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No products yet. Click "Add Product" to create one.</TableCell>
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
              <div className="border rounded-md overflow-y-auto overflow-x-auto overscroll-contain relative z-0" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <Table noScrollWrapper>
                    <TableHeader>
                  <TableRow className="border-b bg-card">
                    <TableHead className="sticky top-0 z-20 h-12 bg-card font-medium shadow-[0_1px_0_0_hsl(var(--border))]">Category Name</TableHead>
                    <TableHead className="sticky top-0 z-20 h-12 bg-card font-medium text-right shadow-[0_1px_0_0_hsl(var(--border))]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {categoriesLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">Loading categories...</TableCell>
                  </TableRow>
                ) : typedCategories && typedCategories.length > 0 ? (
                  typedCategories.map((c: ApiCategory) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="touch-target h-9 w-9" aria-label="Actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[10rem]">
                            <DropdownMenuItem className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer" onClick={() => openCategoryDialog(c)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="min-h-[44px] sm:min-h-0 touch-target cursor-pointer text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg sm:text-xl">Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm">
                                    This action cannot be undone. This will permanently delete the category. Any products in this category will not be deleted but will need to be re-categorized.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                  <AlertDialogCancel className="min-h-[44px] touch-target w-full sm:w-auto" disabled={deletingCategoryId === c.id || isDeletingCategory}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => handleDeleteCategory(c.id!)} disabled={deletingCategoryId === c.id || isDeletingCategory}>
                                    {(deletingCategoryId === c.id || isDeletingCategory) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {deletingCategoryId === c.id || isDeletingCategory ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">No categories yet. Click "Add Category" to create one.</TableCell>
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
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
                <DialogDescription>
                    {editingProduct ? 'Update the product information below.' : 'Fill in the details to add a new product to your catalogue.'}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
              <Form {...productForm}>
                  <form onSubmit={productForm.handleSubmit(handleProductSubmit)} className="space-y-4">
                    <FormField control={productForm.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Product Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={productForm.control} name="category" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {typedCategories
                                      .filter((c: ApiCategory, index: number, self: ApiCategory[]) => 
                                        // Keep only the first occurrence of each category name
                                        index === self.findIndex((cat: ApiCategory) => cat.name === c.name)
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
                    )} />
                     <FormField control={productForm.control} name="price" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Price</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={productForm.control} name="costPrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cost Price (Optional)</FormLabel>
                            <FormControl><Input required type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={productForm.control} name="stock" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Stock (Optional)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={productForm.control} name="barcode" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Barcode (Optional)</FormLabel>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input {...field} placeholder="Enter or scan barcode" />
                                    </FormControl>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="icon"
                                        onClick={() => setIsBarcodeScannerOpen(true)}
                                        title="Scan barcode"
                                    >
                                        <QrCode className="h-4 w-4" />
                                    </Button>
                                </div>
                                {field.value && (
                                    <div className="p-3 border rounded-md bg-background">
                                        <BarcodeDisplay 
                                          value={field.value} 
                                          format={field.value.length === 13 ? "EAN13" : "CODE128"} 
                                          height={60} 
                                          width={2} 
                                        />
                                    </div>
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={productForm.control} name="imageUrl" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Product Image (Optional)</FormLabel>
                            <FormControl>
                                <ImageUpload
                                    productId={editingProduct?.id || `temp-${Date.now()}`}
                                    currentImageUrl={productImageUrl || field.value}
                                    onUploadSuccess={(url) => {
                                        setProductImageUrl(url);
                                        field.onChange(url);
                                    }}
                                    onUploadError={(error) => {
                                        feedback.error('Upload failed', error, 'Check file size (max 2MB) and format, then try again.');
                                    }}
                                    onDelete={() => {
                                        setProductImageUrl(null);
                                        field.onChange('');
                                    }}
                                    maxSizeMB={2}
                                    disabled={false}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                  </form>
              </Form>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4 flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button type="button" variant="secondary" className="min-h-[44px] touch-target w-full sm:w-auto" disabled={isCreatingProduct || isUpdatingProduct}>Cancel</Button></DialogClose>
                <Button type="submit" className="min-h-[44px] touch-target w-full sm:w-auto" onClick={productForm.handleSubmit(handleProductSubmit)} disabled={isCreatingProduct || isUpdatingProduct}>
                  {(isCreatingProduct || isUpdatingProduct) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreatingProduct ? 'Creating...' : isUpdatingProduct ? 'Updating...' : 'Save'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* Category Dialog */}
    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
                <DialogDescription className="text-sm">
                    {editingCategory ? 'Update the category name below.' : 'Enter a name for the new category.'}
                </DialogDescription>
            </DialogHeader>
            <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                    <FormField control={categoryForm.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <DialogClose asChild><Button type="button" variant="secondary" className="min-h-[44px] touch-target w-full sm:w-auto" disabled={isCreatingCategory || isUpdatingCategory}>Cancel</Button></DialogClose>
                        <Button type="submit" className="min-h-[44px] touch-target w-full sm:w-auto" disabled={isCreatingCategory || isUpdatingCategory}>
                          {(isCreatingCategory || isUpdatingCategory) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isCreatingCategory ? 'Creating...' : isUpdatingCategory ? 'Updating...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Dialog open={isBarcodeScannerOpen} onOpenChange={setIsBarcodeScannerOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>
            Use your camera or barcode scanner device to read the product barcode.
          </DialogDescription>
        </DialogHeader>
        <BarcodeScanner
          isOpen={isBarcodeScannerOpen}
          onScan={(barcode) => {
            productForm.setValue('barcode', barcode);
            setIsBarcodeScannerOpen(false);
          }}
          onClose={() => setIsBarcodeScannerOpen(false)}
        />
      </DialogContent>
    </Dialog>
    </div>
  );
}
