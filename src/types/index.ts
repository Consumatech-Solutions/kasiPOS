
export interface Store {
  id: number;
  name: string;
  vatNumber: string | null;
  logoUrl: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  isSetupComplete: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreDto {
  name: string;
  vatNumber?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

export interface UpdateStoreDto {
  name?: string;
  vatNumber?: string;
  logoUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  isSetupComplete?: boolean;
}

export interface Product {
  id?: string; // UUID (backend)
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  barcode?: string;
  barCode?: string; // Added for backend compatibility
  imageUrl: string;
  imageHint?: string;
  lowStockThreshold?: number;
  storeId?: number; // Optional - products are now global, not tied to a specific store
}

export interface Customer {
  id: string; // UUID
  name: string;
  contact: string;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDto {
  name: string;
  contact: string;
  loyaltyPoints?: number;
}

export interface UpdateCustomerDto {
  name?: string;
  contact?: string;
  loyaltyPoints?: number;
}

export interface TransactionItem {
  productId: string; // UUID (backend)
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  stock?: number;
}

export interface Transaction {
  id?: string; // UUID (backend)
  customerId?: string | null;
  date?: Date; // For backward compatibility
  createdAt?: string; // ISO date string from backend
  items: TransactionItem[];
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  voucherCode?: string | null;
  discountAmount?: number | null;
  storeId: number;
}

export interface Voucher {
  id?: string; // UUID (backend)
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  isActive: boolean;
  expiresAt?: string | null; // ISO date string
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  currentUses?: number;
  customerUsages?: Record<string, number> | null;
  storeId: number;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

export interface Category {
  id?: number;
  name: string;
  storeId?: number; // Optional for backward compatibility, but not used for filtering

}

export type StockAdjustmentReason = 'New stock received' | 'Shrinkage' | 'Damages' | 'Expired' | 'Other';

export interface StockAdjustment {
  id?: string; // UUID (backend)
  productId: string;
  productName: string; // denormalized for easier display
  date?: Date; // For backward compatibility
  createdAt?: string; // ISO date string from backend
  oldStock: number;
  newStock: number;
  reason: StockAdjustmentReason;
  note?: string | null;
  storeId: number;
}

export type ParcelStatus = 'Incoming' | 'Received' | 'Collected';

export interface Parcel {
  id?: string; // UUID (backend)
  deliveryNumber: string;
  customerName: string;
  status: ParcelStatus;
  collectionCode?: string | null;
  receiptCode?: string | null;
  dateReceived?: Date | string | null;
  dateCollected?: Date | string | null;
  collectingPersonName?: string | null;
  collectingPersonPhone?: string | null;
  collectingPersonId?: string | null;
  storeId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  groupPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id?: string; // UUID (backend)
  orderCode: string;
  date?: Date; // For backward compatibility
  createdAt?: string; // ISO date string from backend
  items: PurchaseOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryMethod: 'delivery' | 'collection';
  status: 'pending' | 'completed' | 'cancelled';
  storeId: number;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'admin' | 'staff';
  storeId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'fr' | 'sw' | 'zu' | 'so' | 'am';
  campaigns: boolean;
  marketplace: boolean;
  boph: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
  currentStore: Store | null;
}
