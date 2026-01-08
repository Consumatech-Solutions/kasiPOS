export interface Product {
  id?: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  barcode?: string;
  imageUrl: string;
  imageHint?: string;
  lowStockThreshold?: number;
}

export interface Customer {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
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
}

export interface Voucher {
  id?: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  isActive: boolean;
}

export interface Category {
    id?: number;
    name: string;
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
}
    
