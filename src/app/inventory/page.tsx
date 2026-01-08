'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { useState } from 'react';
import { db } from '@/lib/db';
import type { Product } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Check } from 'lucide-react';

export default function InventoryPage() {
  const products = useLiveQuery(() => db.products.toArray(), []);
  const { toast } = useToast();
  const [editingValues, setEditingValues] = useState<Record<string, { stock?: number; threshold?: number }>>({});

  const getStockBadgeVariant = (stock: number, threshold?: number) => {
    if (threshold !== undefined && stock <= threshold) return 'destructive';
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
            {products && products.length > 0 ? (
              products.map(product => {
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
