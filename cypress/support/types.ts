export type SeedAuthSession = {
  token: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: 'admin' | 'staff' | 'store_admin';
    storeId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  store: {
    id: string;
    name: string;
    vatNumber: string | null;
    logoUrl: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
    isSetupComplete: boolean;
    ownerId: string;
    enabledModules: {
      campaigns: boolean;
      marketplace: boolean;
      boph: boolean;
      buyStock: boolean;
      showVatInCheckout: boolean;
    };
    credit?: {
      customerCredit: {
        creditLimit: number;
        termType: 'fixed' | 'variable';
        term?: number;
      };
    } | null;
    createdAt: string;
    updatedAt: string;
  };
  settings: {
    theme: 'light' | 'dark';
    currentStore: Record<string, unknown>;
    showVatInCheckout: boolean;
  };
};

export type ProductRecord = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  barcode?: string;
  imageUrl?: string;
  lowStockThreshold?: number;
  storeId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CategoryRecord = {
  id: string;
  name: string;
  storeId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  contact: string;
  loyaltyPoints: number;
  storeId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionRecord = {
  id: string;
  customerId?: string | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
  }>;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Credit';
  voucherCode?: string | null;
  discountAmount?: number | null;
  storeId: string;
  createdAt?: string;
};

export type VoucherRecord = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  isActive: boolean;
  expiresAt?: string | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  currentUses?: number;
  storeId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StockAdjustmentRecord = {
  id: string;
  productId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  reason: string;
  note?: string | null;
  storeId: string;
  createdAt?: string;
};

export type ParcelRecord = {
  id: string;
  storeId: string;
  deliveryNumber: string;
  customerName: string;
  status: 'Incoming' | 'Received' | 'Collected';
  collectionCode?: string | null;
  receiptCode?: string | null;
  dateReceived?: string | null;
  dateCollected?: string | null;
  collectingPersonName?: string | null;
  collectingPersonPhone?: string | null;
  collectingPersonId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketplaceStoreRecord = {
  id: string;
  code: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceOrderRecord = {
  id: string;
  orderCode: string;
  marketplaceStoreId: string;
  storeId: string;
  customerId?: string | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
  }>;
  subtotal: number;
  vatAmount: number;
  serviceFee: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type SeedData = {
  products: ProductRecord[];
  categories: CategoryRecord[];
  customers: CustomerRecord[];
  transactions: TransactionRecord[];
  vouchers: VoucherRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  parcels: ParcelRecord[];
  marketplaceStores: MarketplaceStoreRecord[];
  marketplaceOrders: MarketplaceOrderRecord[];
};

