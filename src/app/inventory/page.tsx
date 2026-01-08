
'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/db';
import type { Product, Category, StockAdjustment, StockAdjustmentReason } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
  const allProducts = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const { toast } = useToast();

  // Dialog states
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Threshold editing state
  const [editingThresholdId, setEditingThresholdId] = useState<number | null>(null);
  const [thresholdValue, setThresholdValue] = useState(0);

  const stockAdjustments = useLiveQuery(() => {
    if (selectedProduct) {
      return db.stockAdjustments.where('productId').equals(selectedProduct.id!).reverse().toArray();
    }
    return [];
  }, [selectedProduct]);

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
  });

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || (product.stock <= (product.lowStockThreshold || 0) && (product.lowStockThreshold || 0) > 0);
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [allProducts, searchTerm, selectedCategory, showLowStockOnly]);

  const getStockBadgeVariant = (stock: number, threshold?: number) => {
    if (threshold !== undefined && threshold > 0 && stock <= threshold) return 'destructive';
    if (stock < 50) return 'secondary';
    return 'default';
  };
  
  const openAdjustmentDialog = (product: Product) => {
    setSelectedProduct(product);
    form.reset({
      newStock: product.stock,
      reason: 'New stock received',
      note: ''
    });
    setAdjustmentDialogOpen(true);
  };
  
  const openHistoryDialog = (product: Product) => {
    setSelectedProduct(product);
    setHistoryDialogOpen(true);
  };

  const handleAdjustmentSubmit = async (values: z.infer<typeof adjustmentSchema>) => {
    if (!selectedProduct) return;

    const adjustment: Omit<StockAdjustment, 'id'> = {
      productId: selectedProduct.id!,
      productName: selectedProduct.name,
      date: new Date(),
      oldStock: selectedProduct.stock,
      newStock: values.newStock,
      reason: values.reason as StockAdjustmentReason,
      note: values.note,
    };
    
    try {
      await db.transaction('rw', db.products, db.stockAdjustments, async () => {
        await db.stockAdjustments.add(adjustment);
        await db.products.update(selectedProduct.id!, { stock: values.newStock });
      });

      toast({
        title: "Success",
        description: `Stock for ${selectedProduct.name} updated.`,
      });
      setAdjustmentDialogOpen(false);
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to adjust stock.",
      });
    }
  };

  const handleThresholdUpdate = async (id: number) => {
    if (thresholdValue < 0) {
      toast({ variant: "destructive", title: "Error", description: "Threshold must be zero or more." });
      return;
    }
    try {
      await db.products.update(id, { lowStockThreshold: thresholdValue });
      toast({ title: "Success", description: "Low stock trigger updated." });
      setEditingThresholdId(null);
    } catch (error) {
      console.error("Failed to update threshold:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update threshold." });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <CardDescription>Manage your product inventory and set low stock alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
                      {categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Low Stock Trigger</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts && filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="rounded-md object-cover"
                        data-ai-hint={product.imageHint}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStockBadgeVariant(product.stock, product.lowStockThreshold)}>
                          {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                            <span>{product.lowStockThreshold || 0}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingThresholdId(product.id!); setThresholdValue(product.lowStockThreshold || 0); }}>
                              <Edit className="h-3 w-3"/>
                            </Button>
                          </>
                        )}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openAdjustmentDialog(product)}>Adjust Stock</Button>
                      <Button size="sm" variant="ghost" className="ml-2" onClick={() => openHistoryDialog(product)}>
                        <History className="h-4 w-4 mr-1" /> History
                      </Button>
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
        </CardContent>
      </Card>
      
      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock for {selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Current stock: {selectedProduct?.stock}. Enter the new stock level and reason for adjustment.
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
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Save Adjustment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock Adjustment History for {selectedProduct?.name}</DialogTitle>
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
              {stockAdjustments?.map(adj => {
                const change = adj.newStock - adj.oldStock;
                return (
                  <TableRow key={adj.id}>
                    <TableCell>{format(adj.date, 'Pp')}</TableCell>
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
