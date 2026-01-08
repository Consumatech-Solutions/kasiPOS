
'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { db } from '@/lib/db';
import type { Product, Category } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Check, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';


export default function InventoryPage() {
  const allProducts = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const { toast } = useToast();
  
  const [editingValues, setEditingValues] = useState<Record<string, { stock?: number; threshold?: number }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(product => {
      const stock = editingValues[product.id!]?.stock ?? product.stock;
      const threshold = editingValues[product.id!]?.threshold ?? product.lowStockThreshold ?? 0;
      
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || (stock <= threshold && threshold > 0);

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [allProducts, searchTerm, selectedCategory, showLowStockOnly, editingValues]);


  const getStockBadgeVariant = (stock: number, threshold?: number) => {
    if (threshold !== undefined && threshold > 0 && stock <= threshold) return 'destructive';
    if (stock < 50) return 'secondary';
    return 'default';
  };

  const handleValueChange = (id: number, field: 'stock' | 'threshold', value: string) => {
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue) && numericValue >= 0) {
      setEditingValues(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field]: numericValue,
        },
      }));
    }
  };
  
  const handleStockIncrement = (product: Product, amount: number) => {
    const currentEditingValue = editingValues[product.id!]?.stock;
    const currentStock = currentEditingValue !== undefined ? currentEditingValue : product.stock;
    const newStock = Math.max(0, currentStock + amount);
    setEditingValues(prev => ({
      ...prev,
      [product.id!]: {
        ...prev[product.id!],
        stock: newStock,
      },
    }));
  };

  const handleUpdate = async (id: number) => {
    const updates = editingValues[id];
    if (!updates) return;

    try {
      const productToUpdate = await db.products.get(id);
      if (productToUpdate) {
        const finalUpdates: Partial<Product> = {};
        if (updates.stock !== undefined) {
          finalUpdates.stock = updates.stock;
        }
        if (updates.threshold !== undefined) {
          finalUpdates.lowStockThreshold = updates.threshold;
        }

        await db.products.update(id, finalUpdates);

        toast({
          title: "Success",
          description: `${productToUpdate.name} has been updated.`,
        });

        // Clear editing state for this product
        setEditingValues(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }
    } catch (error) {
      console.error("Failed to update product:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update product.",
      });
    }
  };
  

  return (
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
              <TableHead className="w-[180px]">Stock</TableHead>
              <TableHead className="w-[200px]">Low Stock Trigger</TableHead>
              <TableHead className="text-right w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map(product => {
                const isEditing = !!editingValues[product.id!];
                const editingStock = editingValues[product.id!]?.stock;
                const editingThreshold = editingValues[product.id!]?.threshold;
                const displayStock = editingStock !== undefined ? editingStock : product.stock;
                const displayThreshold = editingThreshold !== undefined ? editingThreshold : (product.lowStockThreshold || 0);

                return (
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
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleStockIncrement(product, -1)}><Minus className="h-4 w-4"/></Button>
                        <Input 
                            type="number" 
                            className="w-16 h-8 text-center" 
                            value={displayStock}
                            onChange={(e) => handleValueChange(product.id!, 'stock', e.target.value)}
                        />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleStockIncrement(product, 1)}><Plus className="h-4 w-4" /></Button>
                        <Badge variant={getStockBadgeVariant(displayStock, product.lowStockThreshold)} className="ml-2">
                            {displayStock}
                        </Badge>
                      </div>
                    </TableCell>
                     <TableCell>
                      <Input 
                        type="number" 
                        className="w-24 h-8"
                        placeholder="e.g. 10"
                        value={displayThreshold}
                        onChange={(e) => handleValueChange(product.id!, 'threshold', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing && (
                         <Button size="sm" onClick={() => handleUpdate(product.id!)}>
                           <Check className="h-4 w-4 mr-1" />
                           Save
                         </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
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
  );
}
