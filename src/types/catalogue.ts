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

// Product templates (Admin Portal) for Store Admin "Add from templates"
export interface ProductTemplate {
  id: string;
  name: string;
  categoryId: string;
  category?: { id: string; name: string };
  price?: number;
  costPrice?: number;
  productImage?: string | null;
  [key: string]: unknown;
}

/** One entry for POST /products/add-template. Backend finds or creates category by name, then creates products. */
export interface AddTemplateItem {
  categoryName: string;
  productTemplateIds: string[];
}

/** Body for POST /products/add-template. Only items; no role nor storeId (backend reads them from JWT / req.user). */
export interface AddTemplateRequest {
  items: AddTemplateItem[];
}

/** Response of POST /products/add-template (201): array of created products */
export interface AddTemplateProductResponse {
  id: string;
  name: string;
  categoryId: string;
  storeId: string;
  price: number;
  costPrice: number;
}

// Types for IndexedDB with sync
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
