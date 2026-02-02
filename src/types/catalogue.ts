// Types for Backend Catalogue API

export interface ApiCategory {
  id: string; // UUID
  name: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface CreateCategoryDto {
  name: string;
}

export interface UpdateCategoryDto {
  name?: string;
}

export interface ApiProduct {
  id: string; // UUID
  name: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
  price: number; // decimal(10,2)
  costPrice: number; // decimal(10,2)
  stock: number | null;
  barCode: string | null;
  productImage: string | null; // URL
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface CreateProductDto {
  name: string;
  categoryId: string; // UUID
  price: number;
  costPrice: number;
  stock?: number;
  barCode?: string;
  productImage?: string;
}

export interface UpdateProductDto {
  name?: string;
  categoryId?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  barCode?: string;
  productImage?: string;
}

// Types pour IndexedDB avec synchronisation
export interface CategoryRecord extends ApiCategory {
  synced: boolean;
  lastSyncedAt?: string;
  storeId?: number; // For backward compatibility
}

export interface ProductRecord {
  id: string;
  name: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  } | string; // Can be object (API) or string (local compatibility)
  price: number;
  costPrice: number;
  stock: number | null;
  barCode: string | null;
  productImage: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  lastSyncedAt?: string;
  storeId?: number; // For backward compatibility
  // Compatibility fields with local Product type
  barcode?: string; // Alias for barCode
  imageUrl?: string; // Alias for productImage
  imageHint?: string; // For placeholder images
}
