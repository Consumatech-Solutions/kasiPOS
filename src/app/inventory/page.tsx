
'use client';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { StockAdjustmentReason } from '@/types';
import { useProducts, useCategories } from '@/hooks/use-catalogue';
import { useStockAdjustments } from '@/hooks/use-stock-adjustments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { Search, History, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

const adjustmentSchema = z.object({
  newStock: z.coerce.number().int().min(0, { message: "Stock can't be negative." }),
  reason: z.enum(['New stock received', 'Shrinkage', 'Damages', 'Expired', 'Other']),
  note: z.string().optional(),
});

const reasons: StockAdjustmentReason[] = ['New stock received', 'Shrinkage', 'Damages', 'Expired', 'Other'];

export default function InventoryPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;
  const { toast } = useToast();
  
  // Use API hooks for products and categories
  const { products: apiProducts, loading: productsLoading, setFilters: setProductFilters, refresh: refreshProducts, updateProduct } = useProducts(1, 10);
  const { categories: apiCategories, loading: categoriesLoading } = useCategories(1, 10);

  const allProducts = apiProducts || [];
  const categories = apiCategories || [];

  // Dialog states
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Threshold editing state
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState(0);

  // Use API hook for stock adjustments
  const { adjustments: stockAdjustments, loading: adjustmentsLoading, createAdjustment } = useStockAdjustments({
    productId: selectedProduct?.id,
  });

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
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
      newStock: product.stock ?? 0,
      reason: 'New stock received',
      note: ''
    });
    setAdjustmentDialogOpen(true);
  };
  
  const openHistoryDialog = (product: any) => {
    setSelectedProduct(product);
    setHistoryDialogOpen(true);
  };

  const handleAdjustmentSubmit = async (values: z.infer<typeof adjustmentSchema>) => {
    if (!selectedProduct || !selectedProduct.id) return;

    try {
      await createAdjustment({
        productId: selectedProduct.id,
        newStock: values.newStock,
        reason: values.reason as StockAdjustmentReason,
        note: values.note,
      });

      // Refresh the products list to show updated stock
      await refreshProducts();

      toast({
        title: "Success",
        description: `Stock for ${selectedProduct.name} updated.`,
      });
      setAdjustmentDialogOpen(false);
      setSelectedProduct(null);
    } catch (error: any) {
      console.error("Failed to adjust stock:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to adjust stock.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  const handleThresholdUpdate = async (id: string) => {
    if (thresholdValue < 0) {
      toast({ variant: "destructive", title: "Error", description: "Threshold must be zero or more." });
      return;
    }
    
    try {
      await updateProduct(id, { lowStockThreshold: thresholdValue });
      
      // Refresh the products list to show updated threshold
      await refreshProducts();
      
      toast({ title: "Success", description: "Low stock trigger updated." });
      setEditingThresholdId(null);
    } catch (error: any) {
      console.error("Failed to update threshold:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to update threshold.";
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: errorMessage 
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Inventory Management</CardTitle>
          <CardDescription className="text-sm">Manage your product inventory and set low stock alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
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
                      <Image
                        src={(product as any).productImage || (product as any).imageUrl || '/placeholder-product.png'}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="rounded-md object-cover"
                        data-ai-hint={(product as any).imageHint}
                      />
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
                          <>
                            <Input 
                              type="number" 
                              className="w-24 h-8"
                              value={thresholdValue}
                              onChange={(e) => setThresholdValue(Number(e.target.value))}
                              onBlur={() => handleThresholdUpdate(product.id!)}
                              onKeyDown={(e) => e.key === 'Enter' && handleThresholdUpdate(product.id!)}
                              autoFocus
                            />
                          </>
                        ) : (
                          <>
                            <span>{(product as any).lowStockThreshold || 0}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 touch-target" onClick={() => { setEditingThresholdId(product.id!); setThresholdValue((product as any).lowStockThreshold || 0); }}>
                              <Edit className="h-3 w-3"/>
                            </Button>
                          </>
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
              Current stock: {selectedProduct?.stock ?? 0}. Enter the new stock level and reason for adjustment.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAdjustmentSubmit)} className="space-y-4">
              <FormField control={form.control} name="newStock" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Stock Quantity</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button type="button" variant="secondary" className="min-h-[44px] touch-target w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" className="min-h-[44px] touch-target w-full sm:w-auto">Save Adjustment</Button>
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
    </>
  );
}
