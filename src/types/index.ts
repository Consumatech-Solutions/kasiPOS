/** Store-level feature flags; used for nav and settings (synced with backend enabledModules/enabledFeatures). */
export interface StoreEnabledModules {
  boph?: boolean;
  buyStock?: boolean;
  campaigns?: boolean;
  groupbuying?: boolean;
  marketplace?: boolean;
  showVatInCheckout?: boolean;
}

/** Store credit settings (from GET/PATCH settings). When null/absent, credit payment is disabled. */
export interface StoreCreditSetting {
  customerCredit: {
    creditLimit: number;
    termType: "fixed" | "variable";
    term?: number; // required when termType === 'fixed' (days)
  };
}

export interface Store {
  /** Store ID: UUID (string) from backend. */
  id: string;
  name: string;
  vatNumber: string | null;
  logoUrl: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  isSetupComplete: boolean;
  ownerId: string;
  /** Feature flags for this store; drives nav and settings. */
  enabledModules?: StoreEnabledModules;
  /** Credit config: when present, Credit payment is available. From store/settings API. */
  credit?: StoreCreditSetting | null;
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
  enabledModules?: StoreEnabledModules;
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
  /** Store this customer belongs to (backend scopes by store). */
  storeId?: string | null;
  /** Total outstanding credit (sales on credit not yet paid). */
  outstandingCredit?: number;
}

export interface CreateCustomerDto {
  name: string;
  contact: string;
  loyaltyPoints?: number;
  /** Optional: for admin only; attach customer to this store. Omit for store admin (backend uses JWT). */
  storeId?: string | null;
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

/** Structured discount on a transaction (manual discount from "Apply discount" modal). */
export interface TransactionDiscount {
  discountType: "amount" | "percentage";
  discountAmount: number;
  discountReason: string;
}

/** Credit sale details (payment date, note). */
export interface TransactionCreditDetails {
  paymentDate?: string; // ISO 8601
  note?: string;
}

export interface Transaction {
  id?: string; // UUID (backend)
  customerId?: string | null;
  date?: Date; // For backward compatibility
  createdAt?: string; // ISO date string from backend
  /** Client-only: sent as Idempotency-Key on POST /transactions (offline queue + dedupe) */
  idempotencyKey?: string;
  items: TransactionItem[];
  total: number;
  paymentMethod: "Cash" | "Card" | "Mobile Money" | "Credit";
  voucherCode?: string | null;
  /** @deprecated Use discount.discountAmount when discount object is present. */
  discountAmount?: number | null;
  /** Structured discount (type, value, reason). Present when a manual discount was applied. */
  discount?: TransactionDiscount | null;
  /** Store ID: UUID (string) from backend. */
  storeId: string;
  /** Present when paymentMethod is 'Credit'. */
  creditDetails?: TransactionCreditDetails | null;
}

export interface Voucher {
  id?: string; // UUID (backend)
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minPurchase: number;
  isActive: boolean;
  expiresAt?: string | null; // ISO date string
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  currentUses?: number;
  customerUsages?: Record<string, number> | null;
  storeId: string;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

export interface Category {
  id?: number;
  name: string;
  storeId?: string; // Optional for backward compatibility, but not used for filtering
}

export type StockAdjustmentReason =
  | "New stock received"
  | "Returns"
  | "Shrinkage"
  | "Expansion"
  | "Damages"
  | "Expired";

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
  storeId: string;
}

export type ParcelStatus = "Incoming" | "Received" | "Collected";

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
  storeId: string;
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
  deliveryMethod: "delivery" | "collection";
  status: "pending" | "completed" | "cancelled";
  storeId: string;
}

/** User roles: admin (back-office), staff (store staff), store_admin (store owner from assign-store). */
export type UserRole = "admin" | "staff" | "store_admin";

export interface User {
  id: string;
  email?: string;
  phone: string;
  name: string;
  role: UserRole;
  /** Store UUID (for staff/store_admin); null for admin. */
  storeId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string;
}

export interface AppSettings {
  theme: "light" | "dark";
  language: "en" | "fr" | "sw" | "zu" | "so" | "am";
  campaigns: boolean;
  marketplace: boolean;
  boph: boolean;
  buyStock: boolean;
  /** Admin-only: show VAT line in checkout summary (prices remain VAT-inclusive). */
  showVatInCheckout?: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
  currentStore: Store | null;
}
