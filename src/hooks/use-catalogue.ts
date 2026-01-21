import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { catalogueApi } from '@/lib/api/catalogue';
import { catalogueSyncService } from '@/lib/sync/catalogue-sync';
import type { Category, Product } from '@/types';
import type { CreateCategoryDto, UpdateCategoryDto, CreateProductDto, UpdateProductDto } from '@/types/catalogue';
import type { PaginationMeta } from '@/types/pagination';

export function useCategories(initialPage: number = 1, initialLimit: number = 10) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const limit = initialLimit;

  // Live query for local categories
  const allCategories = useLiveQuery(() => {
    return db.categories.toArray();
  }, []) || [];

  // Paginate categories client-side
  const categories = useMemo(() => {
    const start = (currentPage - 1) * limit;
    const end = start + limit;
    return allCategories.slice(start, end);
  }, [allCategories, currentPage, limit]);

  // Calculate pagination meta
  const pagination: PaginationMeta = useMemo(() => ({
    total: allCategories.length,
    page: currentPage,
    limit,
    totalPages: Math.ceil(allCategories.length / limit) || 1,
  }), [allCategories.length, currentPage, limit]);

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

  const loadPage = useCallback((page: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Loading categories page ${page}`);
    }
    setCurrentPage(page);
  }, []);

  return {
    categories,
    pagination,
    loading,
    error,
    syncing,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: loadAndSync,
    loadPage,
  };
}

export function useProducts(initialPage: number = 1, initialLimit: number = 10) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const limit = initialLimit;

  // Live query for local products
  const allProducts = useLiveQuery(() => {
    return db.products.toArray();
  }, []) || [];
  
  // Debug: log when products change
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Products updated: ${allProducts.length} products in database`);
    }
  }, [allProducts.length]);

  // Sort products by creation date (most recent first) - using id as proxy for creation order
  const sortedProducts = useMemo(() => {
    return [...allProducts].sort((a, b) => {
      // Sort by id descending (higher id = more recent)
      const aId = a.id || 0;
      const bId = b.id || 0;
      return bId - aId;
    });
  }, [allProducts]);

  // Paginate products client-side
  const products = useMemo(() => {
    const start = (currentPage - 1) * limit;
    const end = start + limit;
    return sortedProducts.slice(start, end);
  }, [sortedProducts, currentPage, limit]);

  // Calculate pagination meta
  const pagination: PaginationMeta = useMemo(() => {
    const total = Array.isArray(sortedProducts) ? sortedProducts.length : 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
    
    // Logs de pagination désactivés pour réduire la pollution de la console
    // if (process.env.NODE_ENV === 'development') {
    //   console.log(`📊 Pagination calculated: total=${total}, page=${currentPage}, limit=${limit}, totalPages=${totalPages}`);
    // }
    
    return {
      total,
      page: currentPage,
      limit,
      totalPages,
    };
  }, [sortedProducts, currentPage, limit]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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
            const response = await catalogueApi.categories.getAll();
            // Handle different response formats
            let serverCategories: ApiCategory[] = [];
            if (Array.isArray(response)) {
              serverCategories = response;
            } else if (response && typeof response === 'object') {
              if (Array.isArray(response.data)) {
                serverCategories = response.data;
              } else if (Array.isArray(response.categories)) {
                serverCategories = response.categories;
              } else if (Array.isArray(response.items)) {
                serverCategories = response.items;
              }
            }
            const serverCat = serverCategories.find(c => c.name === categoryName);
            if (serverCat) {
              categoryId = serverCat.id;
            } else {
              // Catégorie n'existe pas sur le serveur, essayer de la créer
              try {
                const newCategory = await catalogueApi.categories.create({ name: categoryName });
                categoryId = newCategory.id;
                // Synchroniser les catégories pour mettre à jour la base locale
                await catalogueSyncService.syncCategories();
              } catch (createErr: any) {
                // Si la création échoue (404, etc.), utiliser la catégorie locale si elle existe
                if (localCat) {
                  // Essayer de trouver l'UUID dans les catégories locales qui ont été synchronisées
                  // Sinon, on utilisera le nom comme fallback et le produit sera créé localement seulement
                  categoryId = categoryName; // Fallback - sera géré plus tard
                  console.warn(`Could not create category "${categoryName}" on server, using local fallback`);
                } else {
                  throw new Error(`Catégorie "${categoryName}" non trouvée et impossible à créer`);
                }
              }
            }
          } catch (err) {
            console.error('Error fetching category:', err);
            // En cas d'erreur réseau, utiliser la catégorie locale si elle existe
            if (localCat) {
              categoryId = categoryName; // Fallback - sera géré plus tard
            } else {
              categoryId = categoryName; // Fallback
            }
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
            const response = await catalogueApi.categories.getAll();
            // Handle different response formats
            let serverCategories: ApiCategory[] = [];
            if (Array.isArray(response)) {
              serverCategories = response;
            } else if (response && typeof response === 'object') {
              if (Array.isArray(response.data)) {
                serverCategories = response.data;
              } else if (Array.isArray(response.categories)) {
                serverCategories = response.categories;
              } else if (Array.isArray(response.items)) {
                serverCategories = response.items;
              }
            }
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
      const createdProduct = { ...productData, id } as Product;
      
      // Vérifier que le produit a bien été créé localement
      const saved = await db.products.get(id);
      if (!saved) {
        throw new Error('Failed to save product to local database');
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Product created locally:', { id, name: saved.name, totalProducts: (await db.products.toArray()).length });
      }

      // Sync if online (en arrière-plan, ne pas bloquer)
      if (navigator.onLine) {
        // Ne pas attendre la synchronisation pour éviter de bloquer l'UI
        // La synchronisation se fera en arrière-plan
        (async () => {
          try {
            // Vérifier que categoryId est un UUID valide (format UUID v4)
            // Si ce n'est pas un UUID, ne pas envoyer au backend (sera synchronisé plus tard)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(categoryId)) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`Category ID "${categoryId}" is not a valid UUID, skipping backend creation. Will sync later.`);
              }
              return;
            }

            // Créer avec l'UUID de la catégorie
            const createDto: CreateProductDto = {
              name: productData.name,
              categoryId,
              price: typeof productData.price === 'number' ? productData.price : parseFloat(String(productData.price)) || 0,
              costPrice: typeof productData.costPrice === 'number' ? productData.costPrice : parseFloat(String(productData.costPrice)) || 0,
              stock: productData.stock !== undefined && productData.stock !== null ? Number(productData.stock) : undefined,
              barCode: productData.barcode && productData.barcode.trim() !== '' ? productData.barcode : undefined,
              productImage: productData.imageUrl && productData.imageUrl.trim() !== '' ? productData.imageUrl : undefined,
            };
            
            // Valider que les champs requis sont présents
            if (!createDto.name || !createDto.categoryId || createDto.price === undefined || createDto.costPrice === undefined) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Missing required fields for product creation, skipping backend sync');
              }
              return;
            }

            await catalogueApi.products.create(createDto);
            // Re-synchroniser pour obtenir l'ID du serveur (en arrière-plan)
            await catalogueSyncService.syncProducts();
          } catch (err: any) {
            // Si erreur 400, logger les détails pour debug
            if (err?.response?.status === 400) {
              console.error('Bad Request (400) - Invalid product data:', {
                createDto: {
                  name: productData.name,
                  categoryId,
                  price: productData.price,
                  costPrice: productData.costPrice,
                  stock: productData.stock,
                  barCode: productData.barcode,
                  productImage: productData.imageUrl,
                },
                error: err?.response?.data || err.message,
              });
            } else if (err?.response?.status !== 404 && err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
              console.error('Sync error:', err);
            }
            // Ne pas bloquer la création locale même si le backend échoue
          }
        })();
      }

      return createdProduct;
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
            const response = await catalogueApi.categories.getAll();
            // Handle different response formats
            let serverCategories: any[] = [];
            if (Array.isArray(response)) {
              serverCategories = response;
            } else if (response && typeof response === 'object') {
              if (Array.isArray(response.data)) {
                serverCategories = response.data;
              } else if (Array.isArray(response.categories)) {
                serverCategories = response.categories;
              } else if (Array.isArray(response.items)) {
                serverCategories = response.items;
              }
            }
            const serverCat = serverCategories.find((c: any) => c.id === data.categoryId);
            if (serverCat) {
              categoryName = serverCat.name;
            }
          } catch (err: any) {
            // Silently handle network errors - expected when backend is not available
            if (err?.response?.status !== 404 && err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
              if (process.env.NODE_ENV === 'development') {
                console.error('Error fetching category:', err);
              }
            }
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

      // Vérifier que le produit existe avant de le mettre à jour
      const existingProduct = await db.products.get(id);
      if (!existingProduct) {
        throw new Error('Produit non trouvé');
      }

      const updateCount = await db.products.update(id, updateData);
      
      // Si la mise à jour n'a pas affecté de ligne, le produit n'existe peut-être plus
      if (updateCount === 0) {
        // Vérifier à nouveau si le produit existe
        const stillExists = await db.products.get(id);
        if (!stillExists) {
          throw new Error('Produit non trouvé');
        }
      }

      // Sync if online (en arrière-plan, ne pas bloquer)
      if (navigator.onLine) {
        // Ne pas attendre la synchronisation pour éviter de bloquer l'UI
        catalogueSyncService.syncProducts().catch((err) => {
          // Logger seulement les erreurs inattendues
          if (err?.response?.status !== 404 && err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
            console.error('Sync error:', err);
          }
        });
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

  const loadPage = useCallback((page: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Loading products page ${page} (total: ${allProducts.length}, totalPages: ${Math.ceil(allProducts.length / limit) || 1})`);
    }
    setCurrentPage(page);
  }, [allProducts.length, limit]);

  return {
    products,
    pagination,
    loading,
    error,
    syncing,
    createProduct,
    updateProduct,
    deleteProduct,
    refresh: loadAndSync,
    loadPage,
  };
}
