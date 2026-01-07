'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/db';
import type { Product, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

// Zod Schemas for validation
const categorySchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
});

const productSchema = z.object({
  name: z.string().min(2, { message: "Product name must be at least 2 characters." }),
  price: z.coerce.number().positive({ message: "Price must be a positive number." }),
  stock: z.coerce.number().int().min(0, { message: "Stock can't be negative." }),
  category: z.string().min(1, { message: "Please select a category." }),
  barcode: z.string().optional(),
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }),
  imageHint: z.string().optional(),
});


export default function CataloguePage() {
  const { toast } = useToast();

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Live queries
  const products = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  // Form Hooks
  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      price: 0,
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
  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      productForm.reset(product);
    } else {
      setEditingProduct(null);
      productForm.reset({
        name: '',
        price: 0,
        stock: 0,
        category: '',
        barcode: '',
        imageUrl: PlaceHolderImages[0].imageUrl,
        imageHint: PlaceHolderImages[0].imageHint
      });
    }
    setProductDialogOpen(true);
  };

  const handleProductSubmit = async (values: z.infer<typeof productSchema>) => {
    try {
      if (editingProduct) {
        await db.products.update(editingProduct.id!, values);
        toast({ title: "Success", description: "Product updated successfully." });
      } else {
        await db.products.add(values as Product);
        toast({ title: "Success", description: "Product added successfully." });
      }
      setProductDialogOpen(false);
    } catch (error) {
      console.error("Failed to save product:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save product." });
    }
  };


  const deleteProduct = async (id: number) => {
    try {
      await db.products.delete(id);
      toast({ title: "Success", description: "Product deleted successfully." });
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete product." });
    }
  };

  // Handlers for Categories
  const openCategoryDialog = (category?: Category) => {
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
      if (editingCategory) {
        await db.categories.update(editingCategory.id!, values);
        toast({ title: "Success", description: "Category updated successfully." });
      } else {
        await db.categories.add(values);
        toast({ title: "Success", description: "Category added successfully." });
      }
      setCategoryDialogOpen(false);
    } catch (error) {
      console.error("Failed to save category:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save category." });
    }
  };

  const deleteCategory = async (id: number) => {
    try {
        await db.categories.delete(id);
        toast({ title: "Success", description: "Category deleted successfully." });
        // Note: You might want to handle products in the deleted category.
    } catch (error) {
        console.error("Failed to delete category:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete category." });
    }
  };

  return (
    <div className="p-4">
    <Card>
      <CardHeader>
        <CardTitle>Catalogue Management</CardTitle>
        <CardDescription>Manage your products and categories.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
          
          {/* Products Tab */}
          <TabsContent value="products">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openProductDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Image src={p.imageUrl} alt={p.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={p.imageHint} />
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>R{p.price.toFixed(2)}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openProductDialog(p)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the product.
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProduct(p.id!)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="flex justify-end mb-4">
                <Button onClick={() => openCategoryDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Category
                </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(c)}><Edit className="h-4 w-4" /></Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the category. Any products in this category will not be deleted but will need to be re-categorized.
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCategory(c.id!)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    {/* Product Dialog */}
    <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            </DialogHeader>
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
                                    {categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
                     <FormField control={productForm.control} name="stock" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Stock</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={productForm.control} name="barcode" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Barcode (Optional)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={productForm.control} name="imageUrl" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    {/* Category Dialog */}
    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
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
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    </div>
  );
}
