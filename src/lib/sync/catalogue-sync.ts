import { catalogueApi } from '../api/catalogue';
import { db } from '../db';
import type { ApiCategory, ApiProduct, CreateCategoryDto, CreateProductDto } from '@/types/catalogue';
import type { Category, Product } from '@/types';

class CatalogueSyncService {
  private isOnline(): boolean {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  // Convert ApiCategory to Category (local format)
  private apiCategoryToLocal(apiCat: ApiCategory): Category {
    return {
      id: parseInt(apiCat.id.replace(/-/g, '').substring(0, 10), 16) || undefined, // Convert UUID to number for compatibility
      name: apiCat.name,
    };
  }

  // Convert Category to ApiCategory
  private localCategoryToApi(cat: Category): CreateCategoryDto {
    return {
      name: cat.name,
    };
  }

  // Convert ApiProduct to Product (local format)
  private apiProductToLocal(apiProd: ApiProduct): Product {
    return {
      id: parseInt(apiProd.id.replace(/-/g, '').substring(0, 10), 16) || undefined,
      name: apiProd.name,
      price: apiProd.price,
      costPrice: apiProd.costPrice,
      stock: apiProd.stock ?? 0,
      category: apiProd.category?.name || '',
      barcode: apiProd.barCode || undefined,
      imageUrl: apiProd.productImage || '',
      // storeId is optional - products are global
    };
  }

  // Convert Product to CreateProductDto
  private localProductToApi(prod: Product, categoryId: string): CreateProductDto {
    return {
      name: prod.name,
      categoryId,
      price: prod.price,
      costPrice: prod.costPrice,
      stock: prod.stock,
      barCode: prod.barcode,
      productImage: prod.imageUrl || undefined,
    };
  }

  // Sync categories - loads from backend and syncs bidirectional
  async syncCategories(removeMockData: boolean = false): Promise<void> {
    if (!this.isOnline()) {
      // Offline mode - sync will happen when connection is restored
      return;
    }

    try {
      // Fetch from backend
      let serverCategories: ApiCategory[];
      try {
        serverCategories = await catalogueApi.categories.getAll();
        if (process.env.NODE_ENV === 'development' && serverCategories.length > 0) {
          console.log(`Fetched ${serverCategories.length} categories from backend`);
        }
      } catch (error: any) {
        // If API is not available (404, network error, etc.), skip sync silently
        // This is expected when backend is not running or endpoint doesn't exist yet
        if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK') {
          // Only log in development mode to reduce console noise
          if (process.env.NODE_ENV === 'development') {
            console.debug('Categories API not available, using local data only');
          }
          return;
        }
        throw error; // Re-throw other errors
      }
      
      // Only remove mock categories if backend has real data
      // This prevents deleting mock data when backend is empty
      // If backend is empty, keep local mock categories for now
      if (removeMockData && serverCategories.length > 0) {
        const { removeMockCategories } = await import('../utils/catalogue-cleanup');
        const removedCount = await removeMockCategories();
        if (removedCount > 0) {
          console.log(`Removed ${removedCount} mock categories - backend has ${serverCategories.length} real categories`);
        }
      } else if (serverCategories.length === 0) {
        console.log('Backend database is empty - keeping local categories (including mock data if any)');
      }

      // Get existing categories after cleanup
      const existingCategories = await db.categories.toArray();
      const categoryMap = new Map<string, number>();

      // Sync server categories to local (backend is source of truth)
      // This ensures we have the latest data from the backend
      for (const apiCat of serverCategories) {
        const localCat = this.apiCategoryToLocal(apiCat);
        
        // Check if a category with the same name already exists
        const existing = existingCategories.find(c => c.name === localCat.name);
        
        if (existing && existing.id) {
          // Update existing category (keep local ID for compatibility)
          await db.categories.update(existing.id, { name: localCat.name });
          categoryMap.set(apiCat.id, existing.id);
        } else {
          // Create new category from server
          const newId = await db.categories.add(localCat);
          categoryMap.set(apiCat.id, newId as number);
        }
      }
      
      if (process.env.NODE_ENV === 'development' && serverCategories.length > 0) {
        console.log(`Synced ${serverCategories.length} categories from backend to local database`);
      }

      // Send unsynced local changes to server
      // Only send categories that don't exist on server
      const localCategories = await db.categories.toArray();
      
      for (const localCat of localCategories) {
        // Check if this category already exists on the server
        const existsOnServer = serverCategories.find(sc => sc.name === localCat.name);
        
        if (!existsOnServer) {
          try {
            // Create on server
            await catalogueApi.categories.create({ name: localCat.name });
            if (process.env.NODE_ENV === 'development') {
              console.log(`Synced local category "${localCat.name}" to server`);
            }
          } catch (error: any) {
            // If API returns 404 or other errors, just log and continue
            // Don't delete local category - it's still valid locally
            if (error?.response?.status !== 404) {
              console.error('Error syncing category to server:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error syncing categories:', error);
      throw error;
    }
  }

  // Synchroniser les produits
  async syncProducts(removeMockData: boolean = false): Promise<void> {
    if (!this.isOnline()) {
      // Offline mode - sync will happen when connection is restored
      return;
    }

    try {
      // Fetch from backend
      let serverProducts: ApiProduct[];
      try {
        serverProducts = await catalogueApi.products.getAll();
        if (process.env.NODE_ENV === 'development' && serverProducts.length > 0) {
          console.log(`Fetched ${serverProducts.length} products from backend`);
        }
      } catch (error: any) {
        // If API is not available (404, network error, etc.), skip sync silently
        // This is expected when backend is not running or endpoint doesn't exist yet
        if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK') {
          // Only log in development mode to reduce console noise
          if (process.env.NODE_ENV === 'development') {
            console.debug('Products API not available, using local data only');
          }
          return;
        }
        throw error; // Re-throw other errors
      }
      
      // Only remove mock products if backend has real data
      // This prevents deleting mock data when backend is empty
      if (removeMockData && serverProducts.length > 0) {
        const { removeMockProducts } = await import('../utils/catalogue-cleanup');
        const removedCount = await removeMockProducts();
        if (removedCount > 0) {
          console.log(`Removed ${removedCount} mock products - backend has ${serverProducts.length} real products`);
        }
      } else if (serverProducts.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Backend database is empty - keeping local products (including mock data if any)');
        }
      }
      
      // Fetch categories for mapping
      const categories = await db.categories.toArray();
      const categoryNameToId = new Map<string, string>();
      
      // Create category name -> category UUID mapping
      let serverCategories: ApiCategory[];
      try {
        serverCategories = await catalogueApi.categories.getAll();
      } catch (error: any) {
        // If categories API is not available, use local categories only
        if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK') {
          // Only log in development mode
          if (process.env.NODE_ENV === 'development') {
            console.debug('Categories API not available for product sync, using local categories only');
          }
          serverCategories = [];
        } else {
          throw error;
        }
      }
      for (const cat of categories) {
        const serverCat = serverCategories.find(sc => sc.name === cat.name);
        if (serverCat) {
          categoryNameToId.set(cat.name, serverCat.id);
        }
      }

      // Sync server products
      const existingProducts = await db.products.toArray();
      
      for (const apiProd of serverProducts) {
        const localProd = this.apiProductToLocal(apiProd);
        
        // Check if a product with the same name already exists
        const existing = existingProducts.find(p => p.name === localProd.name);
        
        if (existing && existing.id) {
          // Update existing product
          await db.products.update(existing.id, localProd);
        } else {
          // Create new product
          await db.products.add(localProd);
        }
      }
      
      if (process.env.NODE_ENV === 'development' && serverProducts.length > 0) {
        console.log(`Synced ${serverProducts.length} products from backend to local database`);
      }

      // Send unsynced local changes
      const localProducts = await db.products.toArray();
      
      for (const localProd of localProducts) {
        // Check if this product already exists on the server
        const existsOnServer = serverProducts.find(sp => sp.name === localProd.name);
        
        if (!existsOnServer) {
          try {
            // Find category UUID
            const categoryId = categoryNameToId.get(localProd.category);
            if (!categoryId) {
              console.warn(`Catégorie "${localProd.category}" non trouvée pour le produit "${localProd.name}"`);
              continue;
            }
            
            // Create on server
            const createDto = this.localProductToApi(localProd, categoryId);
            await catalogueApi.products.create(createDto);
          } catch (error) {
            console.error('Error syncing product:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  // Sync entire catalogue
  async syncAll(): Promise<void> {
    await Promise.all([
      this.syncCategories(),
      this.syncProducts(),
    ]);
  }
}

export const catalogueSyncService = new CatalogueSyncService();

// Écouter les changements de connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Connection restored - sync will be triggered by hooks automatically
  });
}
