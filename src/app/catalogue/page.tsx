'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Product, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useCategories, useProducts } from '@/hooks/use-catalogue';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, QrCode } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


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
  image: z.any()
    .refine((files) => files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 2MB.`)
    .refine(
      (files) => files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ).optional(),
  imageUrl: z.string().optional(),
  imageHint: z.string().optional(),
});


export default function CataloguePage() {
  const { toast } = useToast();

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);


  // Hooks pour les données avec synchronisation
  const { categories, loading: categoriesLoading, createCategory, updateCategory, deleteCategory: deleteCategoryHook } = useCategories();
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct: deleteProductHook } = useProducts();

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

  // Barcode Scanner Effect
  useEffect(() => {
    if (scannerDialogOpen) {
      const getCameraPermission = async () => {
        try {
          // Check for mediaDevices support
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Media Devices API not supported.');
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Not Supported',
              description: 'Your browser does not support camera access.',
            });
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setHasCameraPermission(true);
  
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      };
      getCameraPermission();
    } else {
      // Cleanup: stop video stream when dialog is closed
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [scannerDialogOpen, toast]);

  const fileRef = productForm.register("image");

  // Handlers for Products
  const openProductDialog = (product?: Product) => {
    productForm.reset();
    setImagePreview(null);
    if (product) {
      setEditingProduct(product);
      productForm.setValue('name', product.name);
      productForm.setValue('price', product.price);
      productForm.setValue('costPrice', product.costPrice);
      productForm.setValue('stock', product.stock);
      productForm.setValue('category', product.category);
      productForm.setValue('barcode', product.barcode);
      productForm.setValue('imageUrl', product.imageUrl);
      productForm.setValue('imageHint', product.imageHint);
      if (product.imageUrl) {
        setImagePreview(product.imageUrl);
      }
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
    }
    setProductDialogOpen(true);
  };

  const handleProductSubmit = async (values: z.infer<typeof productSchema>) => {
    try {
      let imageUrl = values.imageUrl;
      let imageHint = values.imageHint;

      // Handle image upload
      if (values.image && values.image.length > 0) {
        const file = values.image[0];
        // For simplicity, we'll use a data URL. In a real app, you'd upload to a service.
        imageUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        imageHint = ''; // No hint for custom uploaded images
      }
      // If no image is provided, leave imageUrl empty (don't assign placeholder automatically)
      
      const productData = {
        name: values.name,
        price: values.price,
        costPrice: values.costPrice,
        stock: values.stock || 0,
        category: values.category,
        barcode: values.barcode,
        imageUrl: imageUrl || '',
        imageHint: imageHint || '',
      };

      if (editingProduct && editingProduct.id) {
        await updateProduct(editingProduct.id, productData);
        toast({ title: "Success", description: "Product updated successfully." });
      } else {
        await createProduct(productData as any);
        toast({ title: "Success", description: "Product added successfully." });
      }
      setProductDialogOpen(false);
      productForm.reset();
    } catch (error) {
      console.error("Failed to save product:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save product.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };


  const handleDeleteProduct = async (id: number) => {
    try {
      await deleteProductHook(id);
      toast({ title: "Success", description: "Product deleted successfully." });
    } catch (error) {
      console.error("Failed to delete product:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete product.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
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
      if (editingCategory && editingCategory.id) {
        await updateCategory(editingCategory.id, values);
        toast({ title: "Success", description: "Category updated successfully." });
      } else {
        await createCategory(values);
        toast({ title: "Success", description: "Category added successfully." });
      }
      setCategoryDialogOpen(false);
      categoryForm.reset();
    } catch (error) {
      console.error("Failed to save category:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save category.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
        await deleteCategoryHook(id);
        toast({ title: "Success", description: "Category deleted successfully." });
        // Note: You might want to handle products in the deleted category.
    } catch (error) {
        console.error("Failed to delete category:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to delete category.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
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
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading products...</TableCell>
                  </TableRow>
                ) : products && products.length > 0 ? (
                  products.map(p => {
                    const price = typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0;
                    const costPrice = typeof p.costPrice === 'number' ? p.costPrice : parseFloat(String(p.costPrice)) || 0;
                    return (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={p.imageHint} />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            No img
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>R{price.toFixed(2)}</TableCell>
                      <TableCell>R{costPrice.toFixed(2)}</TableCell>
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
                                <AlertDialogAction onClick={() => handleDeleteProduct(p.id!)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No products yet. Click "Add Product" to create one.</TableCell>
                  </TableRow>
                )}
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
                {categoriesLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">Loading categories...</TableCell>
                  </TableRow>
                ) : categories && categories.length > 0 ? (
                  categories.map(c => (
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
                                <AlertDialogAction onClick={() => handleDeleteCategory(c.id!)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    {/* Product Dialog */}
    <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
                <DialogDescription>
                    {editingProduct ? 'Update the product information below.' : 'Fill in the details to add a new product to your catalogue.'}
                </DialogDescription>
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
                                    {categories?.map((c, index) => <SelectItem key={c.id ?? `category-${index}-${c.name}`} value={c.name}>{c.name}</SelectItem>)}
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
                            <FormLabel>Cost Price</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
                            <div className="flex gap-2">
                                <FormControl><Input {...field} /></FormControl>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => setScannerDialogOpen(true)}
                                >
                                    <QrCode className="h-4 w-4"/>
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={productForm.control} name="image" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Product Image (Optional)</FormLabel>
                            {imagePreview && <Image src={imagePreview} alt="Image preview" width={80} height={80} className="rounded-md object-cover my-2" />}
                            <FormControl>
                                <Input type="file" accept="image/*" {...fileRef} onChange={(e) => {
                                  field.onChange(e.target.files);
                                  if (e.target.files && e.target.files[0]) {
                                      const file = e.target.files[0];
                                      if (file.size > MAX_FILE_SIZE) {
                                          productForm.setError("image", { type: "manual", message: "Max image size is 2MB." });
                                          setImagePreview(null);
                                      } else if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                                          productForm.setError("image", { type: "manual", message: "Only .jpg, .jpeg, .png and .webp formats are supported." });
                                          setImagePreview(null);
                                      } else {
                                          const reader = new FileReader();
                                          reader.onload = (loadEvent) => {
                                              setImagePreview(loadEvent.target?.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                      }
                                  } else {
                                      setImagePreview(editingProduct?.imageUrl || null);
                                  }
                                }} />
                            </FormControl>
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
                <DialogDescription>
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
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    {/* Barcode Scanner Dialog - Separate from Product Dialog to avoid nesting */}
    <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Scan Barcode</DialogTitle>
                <DialogDescription>Point your camera at a barcode. This is a placeholder and does not scan barcodes yet.</DialogDescription>
            </DialogHeader>
            <div className="relative">
                <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                {hasCameraPermission === false && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access in your browser settings to use the scanner.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </DialogContent>
    </Dialog>

    </div>
  );
}
