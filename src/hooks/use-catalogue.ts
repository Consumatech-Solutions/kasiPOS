import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { catalogueApi } from '@/lib/api/catalogue';
import { catalogueSyncService } from '@/lib/sync/catalogue-sync';
import type { Category, Product } from '@/types';
import type { CreateCategoryDto, UpdateCategoryDto, CreateProductDto, UpdateProductDto } from '@/types/catalogue';

export function useCategories() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Live query for local categories
  const categories = useLiveQuery(() => {
    return db.categories.toArray();
  }, []) || [];

  // Load and sync
  const loadAndSync = useCallback(async (isFirstLoad: boolean = false) => {
    try {
      setLoading(true);
      
      // Load from IndexedDB (already done by useLiveQuery)
      
      // Sync in background if online
      if (navigator.onLine) {
        setSyncing(true);
        try {
          // On first load, remove mock categories and sync from backend
          await catalogueSyncService.syncCategories(isFirstLoad);
        } catch (err) {
          console.error('Sync error:', err);
          // Don't block UI on sync error
        } finally {
          setSyncing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // First load: remove mock data and sync from backend
    loadAndSync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCategory = useCallback(async (data: CreateCategoryDto): Promise<Category> => {
    try {
      const newCategory: Category = {
        name: data.name,
      };

      // Add locally first - this ensures it's saved immediately
      const id = await db.categories.add(newCategory);
      const createdCategory = { ...newCategory, id };
      
      // Verify it was saved
      const saved = await db.categories.get(id);
      if (!saved) {
        throw new Error('Failed to save category to local database');
      }
      
      console.log('Category created and verified locally:', saved);

      // Try to sync with backend immediately (non-blocking)
      if (navigator.onLine) {
        // Try to create on backend immediately
        catalogueApi.categories.create({ name: data.name })
          .then((serverCategory) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('Category created on server:', serverCategory);
            }
          })
          .catch((err: any) => {
            // If backend is not available (404 or network error), that's okay - it will sync later
            // Only log unexpected errors
            if (err?.response?.status !== 404 && err?.code !== 'ERR_NETWORK') {
              console.error('Error creating category on server:', err);
            }
          });
      }

      return createdCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating item');
      throw err;
    }
  }, []);

  const updateCategory = useCallback(async (id: number, data: UpdateCategoryDto): Promise<Category> => {
    try {
      const updateData: Partial<Category> = {};
      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      await db.categories.update(id, updateData);

      // Sync if online
      if (navigator.onLine) {
        try {
          await catalogueSyncService.syncCategories();
        } catch (err) {
          console.error('Sync error:', err);
        }
      }

      const updated = await db.categories.get(id);
      if (!updated) throw new Error('Catégorie non trouvée');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating item');
      throw err;
    }
  }, []);

  const deleteCategory = useCallback(async (id: number): Promise<void> => {
    try {
      const category = await db.categories.get(id);
      if (!category) throw new Error('Category not found');

      // Delete locally
      await db.categories.delete(id);

      // Sync if online
      if (navigator.onLine) {
        try {
          // For deletion, we need to find the corresponding UUID
          // For simplicity, we sync all categories
          await catalogueSyncService.syncCategories();
        } catch (err) {
          console.error('Sync error:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting item');
      throw err;
    }
  }, []);

  return {
    categories,
    loading,
    error,
    syncing,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: loadAndSync,
  };
}

export function useProducts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Live query for local products
  const products = useLiveQuery(() => {
    return db.products.toArray();
  }, []) || [];

  // Load and sync
  const loadAndSync = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load from IndexedDB (already done by useLiveQuery)
      
      // Sync in background if online
      if (navigator.onLine) {
        setSyncing(true);
        try {
          // On first load, remove mock products and sync from backend
          await catalogueSyncService.syncProducts(true);
        } catch (err) {
          console.error('Sync error:', err);
          // Don't block UI on sync error
        } finally {
          setSyncing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAndSync();
  }, [loadAndSync]);

  const createProduct = useCallback(async (data: CreateProductDto | { name: string; price: number; costPrice: number; stock?: number; barCode?: string; productImage?: string; category: string }): Promise<Product> => {
    try {
      // Si data.category est une string (nom de catégorie), convertir en UUID
      let categoryId: string;
      let categoryName: string;
      
      if ('category' in data && typeof data.category === 'string') {
        // C'est un nom de catégorie, trouver l'UUID
        categoryName = data.category;
        const categories = await db.categories.toArray();
        const localCat = categories.find(c => c.name === categoryName);
        
        if (navigator.onLine) {
          try {
            const serverCategories = await catalogueApi.categories.getAll();
            const serverCat = serverCategories.find(c => c.name === categoryName);
            if (serverCat) {
              categoryId = serverCat.id;
            } else if (localCat) {
              // Catégorie locale mais pas sur le serveur, utiliser le nom comme ID temporaire
              categoryId = categoryName;
            } else {
              throw new Error(`Catégorie "${categoryName}" non trouvée`);
            }
          } catch (err) {
            console.error('Error fetching category:', err);
            categoryId = categoryName; // Fallback
          }
        } else {
          categoryId = categoryName; // En mode offline, utiliser le nom
        }
      } else {
        // C'est déjà un CreateProductDto avec categoryId
        categoryId = (data as CreateProductDto).categoryId;
        // Trouver le nom de la catégorie
        categoryName = ''; // Initialize first
        const categories = await db.categories.toArray();
        if (navigator.onLine) {
          try {
            const serverCategories = await catalogueApi.categories.getAll();
            const serverCat = serverCategories.find(c => c.id === categoryId);
            categoryName = serverCat?.name || '';
          } catch (err) {
            console.error('Error fetching category:', err);
            categoryName = '';
          }
        }
        if (!categoryName) {
          const localCat = categories.find(c => c.name === categoryId || c.id?.toString() === categoryId);
          categoryName = localCat?.name || categoryId;
        }
      }

      const productData = 'category' in data 
        ? {
            name: data.name,
            price: data.price,
            costPrice: data.costPrice,
            stock: data.stock ?? 0,
            category: categoryName,
            barcode: data.barCode,
            imageUrl: data.productImage || '',
          }
        : {
            name: data.name,
            price: data.price,
            costPrice: data.costPrice,
            stock: data.stock ?? 0,
            category: categoryName,
            barcode: data.barCode,
            imageUrl: data.productImage || '',
          };

      // Add locally
      const id = await db.products.add(productData as Product);

      // Sync if online
      if (navigator.onLine) {
        try {
          // Créer avec l'UUID de la catégorie
          const createDto: CreateProductDto = {
            name: productData.name,
            categoryId,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock,
            barCode: productData.barcode,
            productImage: productData.imageUrl || undefined,
          };
          await catalogueApi.products.create(createDto);
          // Re-synchroniser pour obtenir l'ID du serveur
          await catalogueSyncService.syncProducts();
        } catch (err) {
          console.error('Sync error:', err);
        }
      }

      return { ...productData, id } as Product;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating item');
      throw err;
    }
  }, []);

  const updateProduct = useCallback(async (id: number, data: UpdateProductDto | Partial<Product>): Promise<Product> => {
    try {
      const updateData: Partial<Product> = {};
      
      // Gérer les deux formats de données
      if ('name' in data && data.name !== undefined) updateData.name = data.name;
      if ('price' in data && data.price !== undefined) updateData.price = data.price;
      if ('costPrice' in data && data.costPrice !== undefined) updateData.costPrice = data.costPrice;
      if ('stock' in data && data.stock !== undefined) updateData.stock = data.stock ?? 0;
      if ('barcode' in data && data.barcode !== undefined) updateData.barcode = data.barcode;
      if ('imageUrl' in data && data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
      
      // Gérer categoryId (UUID) ou category (nom)
      if ('categoryId' in data && data.categoryId !== undefined) {
        // Trouver le nom de la catégorie depuis l'UUID
        const categories = await db.categories.toArray();
        let categoryName = '';
        
        if (navigator.onLine) {
          try {
            const serverCategories = await catalogueApi.categories.getAll();
            const serverCat = serverCategories.find(c => c.id === data.categoryId);
            if (serverCat) {
              categoryName = serverCat.name;
            }
          } catch (err) {
            console.error('Error fetching category:', err);
          }
        }
        
        if (!categoryName) {
          const localCat = categories.find(c => c.name === data.categoryId || c.id?.toString() === data.categoryId);
          categoryName = localCat?.name || data.categoryId;
        }
        
        updateData.category = categoryName;
      } else if ('category' in data && data.category !== undefined) {
        // C'est déjà un nom de catégorie
        updateData.category = data.category;
      }

      await db.products.update(id, updateData);

      // Sync if online
      if (navigator.onLine) {
        try {
          const product = await db.products.get(id);
          if (product) {
            // Trouver l'UUID de la catégorie
            const categories = await db.categories.toArray();
            let categoryId = '';
            
            if (navigator.onLine) {
              try {
                const serverCategories = await catalogueApi.categories.getAll();
                const serverCat = serverCategories.find(c => c.name === product.category);
                if (serverCat) {
                  categoryId = serverCat.id;
                }
              } catch (err) {
                console.error('Error fetching category:', err);
              }
            }
            
            if (categoryId) {
              const updateDto: UpdateProductDto = {
                name: updateData.name,
                categoryId: updateData.category ? categoryId : undefined,
                price: updateData.price,
                costPrice: updateData.costPrice,
                stock: updateData.stock,
                barCode: updateData.barcode,
                productImage: updateData.imageUrl,
              };
              // Note: On ne peut pas mettre à jour directement car on n'a pas l'UUID du produit
              // On synchronise simplement
              await catalogueSyncService.syncProducts();
            }
          }
        } catch (err) {
          console.error('Sync error:', err);
        }
      }

      const updated = await db.products.get(id);
      if (!updated) throw new Error('Produit non trouvé');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating item');
      throw err;
    }
  }, []);

  const deleteProduct = useCallback(async (id: number): Promise<void> => {
    try {
      await db.products.delete(id);

      // Sync if online
      if (navigator.onLine) {
        try {
          await catalogueSyncService.syncProducts();
        } catch (err) {
          console.error('Sync error:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting item');
      throw err;
    }
  }, []);

  return {
    products,
    loading,
    error,
    syncing,
    createProduct,
    updateProduct,
    deleteProduct,
    refresh: loadAndSync,
  };
}
