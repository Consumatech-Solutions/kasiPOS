
'use client';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { StockAdjustmentReason, Product } from '@/types';
import type { ApiProduct } from '@/types/catalogue';
import { useQueryClient } from '@tanstack/react-query';
import { useProducts, useCategories, productKeys } from '@/hooks/use-catalogue';
import { useStockAdjustments } from '@/hooks/use-stock-adjustments';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { mutationQueue } from '@/lib/mutation-queue';
import { executeMutation } from '@/lib/mutation-registry';
import { updateProductStockInDexie } from '@/lib/entity-cache';
import { stockAdjustmentsApi } from '@/lib/api/stock-adjustments';
import { catalogueApi } from '@/lib/api/catalogue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { feedback } from '@/lib/feedback';
import { useSettings } from '@/components/settings-provider';
import { Search, History, Edit, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { getProductInitials } from '@/lib/utils/product-initials';

const REASONS: StockAdjustmentReason[] = ['New stock received', 'Returns', 'Shrinkage', 'Expansion', 'Damages', 'Expired'];

const adjustmentSchema = z.object({
  reason: z.enum(['New stock received', 'Returns', 'Shrinkage', 'Expansion', 'Damages', 'Expired']).optional(),
  quantityOrUpdated: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
});

export default function InventoryPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  // Use API hooks for products and categories
  const { products: apiProducts, loading: productsLoading, setFilters: setProductFilters, refresh: refreshProducts, updateProduct } = useProducts(1, 500, {
    storeIdForOffline: currentStore?.id ?? undefined,
  });
  const { categories: apiCategories, loading: categoriesLoading } = useCategories(1, 100);

  const allProducts = apiProducts || [];
  const categories = apiCategories || [];

  // Dialog states
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | Product | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Threshold editing state
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState(0);

  // Use API hook for stock adjustments
  const { adjustments: stockAdjustments, loading: adjustmentsLoading, createAdjustment, isCreating } = useStockAdjustments({
    productId: selectedProduct?.id,
  });

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { reason: undefined, quantityOrUpdated: undefined, note: '' },
  });

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter((product: any) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryName = product.category?.name || product.category;
      const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory;
      const matchesLowStock = !showLowStockOnly || ((product.stock ?? 0) <= (product.lowStockThreshold || 0) && (product.lowStockThreshold || 0) > 0);
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [allProducts, searchTerm, selectedCategory, showLowStockOnly]);

  const getStockBadgeVariant = (stock: number, threshold?: number) => {
    if (threshold !== undefined && threshold > 0 && stock <= threshold) return 'destructive';
    if (stock < 50) return 'secondary';
    return 'default';
  };
  
  const openAdjustmentDialog = (product: any) => {
    setSelectedProduct(product);
    form.reset({
      reason: undefined as any,
      quantityOrUpdated: undefined as any,
      note: ''
    });
    setAdjustmentDialogOpen(true);
  };

  const currentStock = selectedProduct?.stock ?? 0;
  const reason = form.watch('reason');
  const quantityOrUpdated = form.watch('quantityOrUpdated') ?? 0;

  const computedNewStock = useMemo(() => {
    if (reason == null || quantityOrUpdated == null) return null;
    const q = Number(quantityOrUpdated);
    switch (reason) {
      case 'New stock received':
      case 'Returns':
        return currentStock + q;
      case 'Damages':
      case 'Expired':
        return Math.max(0, currentStock - q);
      case 'Shrinkage':
      case 'Expansion':
        return q;
      default:
        return null;
    }
  }, [reason, quantityOrUpdated, currentStock]);

  const secondFieldLabel = useMemo(() => {
    switch (reason) {
      case 'New stock received': return 'Quantity Received';
      case 'Returns': return 'Quantity Returned';
      case 'Shrinkage': return 'Updated Stock Quantity (must be less than the current stock amount)';
      case 'Expansion': return 'Updated Stock Quantity (must be more than the current stock amount)';
      case 'Damages': return 'Quantity Damaged';
      case 'Expired': return 'Quantity Expired';
      default: return '';
    }
  }, [reason]);

  const showUpdatedStockAboveNotes = reason && reason !== 'Shrinkage' && reason !== 'Expansion' && computedNewStock != null;
  
  const openHistoryDialog = (product: any) => {
    setSelectedProduct(product);
    setHistoryDialogOpen(true);
  };

  const handleAdjustmentSubmit = async (values: z.infer<typeof adjustmentSchema>) => {
    if (!selectedProduct || !selectedProduct.id) return;
    if (!values.reason) {
      feedback.error('Reason required', 'Please select a reason for the adjustment.', 'Select a reason.');
      return;
    }
    if (values.quantityOrUpdated === undefined || values.quantityOrUpdated === null) {
      feedback.error('Quantity required', 'Please enter a value.', 'Enter the quantity or updated stock.');
      return;
    }
    const q = Number(values.quantityOrUpdated);
    const cur = currentStock;
    let newStock: number;
    switch (values.reason) {
      case 'New stock received':
      case 'Returns':
        newStock = cur + q;
        break;
      case 'Damages':
      case 'Expired':
        newStock = Math.max(0, cur - q);
        break;
      case 'Shrinkage':
        if (q >= cur) {
          feedback.error('Invalid value', 'Updated stock must be less than the current stock amount.', 'Enter a lower value.');
          return;
        }
        newStock = q;
        break;
      case 'Expansion':
        if (q <= cur) {
          feedback.error('Invalid value', 'Updated stock must be more than the current stock amount.', 'Enter a higher value.');
          return;
        }
        newStock = q;
        break;
      default:
        return;
    }
    if (newStock < 0) {
      feedback.error('Invalid value', "Stock can't be negative.", 'Reduce the quantity.');
      return;
    }

    try {
      if (isOnline) {
        await createAdjustment({
          productId: selectedProduct.id,
          newStock,
          reason: values.reason as StockAdjustmentReason,
          note: values.note,
        });

        // Refresh the products list to show updated stock
        await refreshProducts();

        feedback.success('Stock updated', `Stock for ${selectedProduct.name} updated.`);
      } else {
        // Offline: apply new stock locally so other transactions (e.g. POS) see it
        const productId = String(selectedProduct.id);

        // 1. Update all product list queries in TanStack Query cache
        const queriesData = queryClient.getQueriesData<{ data: { id?: string; stock?: number | null }[]; meta?: unknown }>({ queryKey: productKeys.lists() });
        queriesData.forEach(([queryKey, data]) => {
          if (data?.data && Array.isArray(data.data)) {
            const updated = {
              ...data,
              data: data.data.map((p) =>
                String(p.id) === productId ? { ...p, stock: newStock } : p
              ),
            };
            queryClient.setQueryData(queryKey, updated);
          }
        });

        // 2. Update Dexie productCache so POS and others see new stock after reload
        await updateProductStockInDexie(productId, newStock);

        // 3. Queue for sync when online
        const variables = {
          productId: selectedProduct.id!,
          newStock,
          reason: values.reason,
          note: values.note,
        };
        mutationQueue.add({
          mutationKey: ['stockAdjustments', 'create'],
          mutationFn: () => executeMutation(['stockAdjustments', 'create'], variables),
          variables,
        });

        feedback.success('Queued', 'Stock updated locally. Will sync when online.');
      }
      setAdjustmentDialogOpen(false);
      setSelectedProduct(null);
    } catch (error: any) {
      console.error("Failed to adjust stock:", error);
      feedback.fromError(error, 'Failed to adjust stock', 'Check your connection and try again.');
    }
  };

  const handleThresholdUpdate = async (id: string) => {
    if (thresholdValue < 0) {
      feedback.error('Invalid threshold', 'Threshold must be zero or more.', 'Enter a value ≥ 0.');
      return;
    }
    
    try {
      if (isOnline) {
        await updateProduct(id, { lowStockThreshold: thresholdValue });
        
        // Refresh the products list to show updated threshold
        await refreshProducts();
        
        feedback.success('Low stock trigger updated', 'Low stock trigger updated.');
      } else {
        // Offline: queue mutation (optimistic update already done by hook)
        mutationQueue.add({
          mutationKey: ['products', 'update'],
          mutationFn: () => catalogueApi.products.update(id, { lowStockThreshold: thresholdValue } as any),
          variables: { id, data: { lowStockThreshold: thresholdValue } },
        });
        feedback.success('Queued', 'Threshold update queued. Will sync when online.');
      }
      setEditingThresholdId(null);
    } catch (error: any) {
      console.error("Failed to update threshold:", error);
      feedback.fromError(error, 'Failed to update threshold', 'Check your connection and try again.');
    }
  };

  return (
    <div className="p-2 sm:p-4 overflow-y-auto h-full">
      <Card>
        <div className="sticky top-0 z-20 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl">Inventory Management</CardTitle>
            <CardDescription className="text-sm">Manage your product inventory and set low stock alerts.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search by product name..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories?.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                    <Switch 
                        id="low-stock-filter" 
                        checked={showLowStockOnly}
                        onCheckedChange={setShowLowStockOnly}
                    />
                    <Label htmlFor="low-stock-filter">Low Stock Only</Label>
                </div>
            </div>
          </CardContent>
        </div>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] hidden sm:table-cell">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="hidden lg:table-cell">Low Stock Trigger</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Loading products...</TableCell>
                </TableRow>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                filteredProducts.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell className="hidden sm:table-cell">
                      {(product as any).productImage || (product as any).imageUrl ? (
                        <div className="relative w-10 h-10">
                          <Image
                            src={(product as any).productImage || (product as any).imageUrl}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                            data-ai-hint={(product as any).imageHint}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const initialsDiv = target.nextElementSibling as HTMLElement;
                              if (initialsDiv) {
                                initialsDiv.style.display = 'flex';
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
                          <Badge variant="outline" className="mt-1 w-fit">{(product as any).category?.name || (product as any).category || 'N/A'}</Badge>
                        </span>
                        <span className="text-xs text-muted-foreground lg:hidden">
                          Threshold: {(product as any).lowStockThreshold || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{(product as any).category?.name || (product as any).category || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStockBadgeVariant(product.stock ?? 0, (product as any).lowStockThreshold)}>
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
                              onChange={(e) => setThresholdValue(Number(e.target.value))}
                              onBlur={() => handleThresholdUpdate(product.id!)}
                              onKeyDown={(e) => e.key === 'Enter' && handleThresholdUpdate(product.id!)}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{(product as any).lowStockThreshold || 0}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 touch-target" onClick={() => { setEditingThresholdId(product.id!); setThresholdValue((product as any).lowStockThreshold || 0); }}>
                              <Edit className="h-3 w-3"/>
                            </Button>
                          </div>
                        )}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col sm:flex-row items-end sm:justify-end gap-2">
                        <Button size="sm" variant="outline" className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => openAdjustmentDialog(product)}>Adjust Stock</Button>
                        <Button size="sm" variant="ghost" className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => openHistoryDialog(product)}>
                          <History className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">History</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Adjust Stock for {selectedProduct?.name}</DialogTitle>
            <DialogDescription className="text-sm">
              Current stock: {currentStock}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAdjustmentSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REASONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
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
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {showUpdatedStockAboveNotes && (
                <p className="text-sm font-medium text-muted-foreground">
                  Updated stock: <span className="text-foreground">{computedNewStock}</span>
                </p>
              )}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (Optional)</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button type="button" variant="secondary" className="min-h-[44px] touch-target w-full sm:w-auto" disabled={isCreating}>Cancel</Button></DialogClose>
                <Button type="submit" className="min-h-[44px] touch-target w-full sm:w-auto" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreating ? 'Saving...' : 'Save Adjustment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Stock Adjustment History for {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Old Stock</TableHead>
                <TableHead>New Stock</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustmentsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Loading history...</TableCell>
                </TableRow>
              ) : stockAdjustments?.map((adj: any) => {
                const change = adj.newStock - adj.oldStock;
                const adjDate = adj.createdAt ? new Date(adj.createdAt) : new Date(adj.date || Date.now());
                return (
                  <TableRow key={adj.id}>
                    <TableCell>{format(adjDate, 'Pp')}</TableCell>
                    <TableCell>{adj.reason}</TableCell>
                    <TableCell>{adj.oldStock}</TableCell>
                    <TableCell>{adj.newStock}</TableCell>
                    <TableCell className={change > 0 ? 'text-green-600' : 'text-red-600'}>
                      {change > 0 ? `+${change}` : change}
                    </TableCell>
                    <TableCell>{adj.note || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
           {(!stockAdjustments || stockAdjustments.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No adjustment history for this product.</p>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
