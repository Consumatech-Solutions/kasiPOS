
export interface Store {
  id?: number;
  name: string;
  vatNumber?: string;
  logoUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  isSetupComplete: boolean;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  barcode?: string;
  imageUrl: string;
  imageHint?: string;
  lowStockThreshold?: number;
  storeId?: number; // Optional - products are now global, not tied to a specific store
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  loyaltyPoints: number;
  storeId: number;
}

export interface TransactionItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  stock?: number;
}

export interface Transaction {
  id?: number;
  customerId?: number;
  date: Date;
  items: TransactionItem[];
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  voucherCode?: string;
  discountAmount?: number;
  storeId: number;
}

export interface Voucher {
  id?: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  isActive: boolean;
  storeId: number;
}

export interface Category {
    id?: number;
    name: string;
    storeId?: number; // Optional for backward compatibility, but not used for filtering

}

export type StockAdjustmentReason = 'New stock received' | 'Shrinkage' | 'Damages' | 'Expired' | 'Other';

export interface StockAdjustment {
  id?: number;
  productId: number;
  productName: string; // denormalized for easier display
  date: Date;
  oldStock: number;
  newStock: number;
  reason: StockAdjustmentReason;
  note?: string;
  storeId: number;
}

export type ParcelStatus = 'Incoming' | 'Received' | 'Collected';

export interface Parcel {
  id?: number;
  deliveryNumber: string;
  customerName: string;
  status: ParcelStatus;
  collectionCode?: string;
  receiptCode?: string;
  dateReceived?: Date;
  dateCollected?: Date;
  collectingPersonName?: string;
  collectingPersonPhone?: string;
  collectingPersonId?: string;
  storeId: number;
}

export interface PurchaseOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  groupPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id?: number;
  orderCode: string;
  date: Date;
  items: PurchaseOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryMethod: 'delivery' | 'collection';
  status: 'pending' | 'completed' | 'cancelled';
  storeId: number;
}

export interface User {
  id?: string;
  name: string;
  phone: string;
  password?: string;
  role: 'admin' | 'staff';
  storeId: number;
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
