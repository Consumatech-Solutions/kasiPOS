/**
 * Error codes for support and debugging.
 * Show these in user-facing error messages (e.g. "Ref: SALE-001") so support can identify the flow.
 * All comments and code names in English.
 */
export const ERROR_CODES = {
  SALE: 'SALE',
  SALE_OFFLINE: 'SALE-OFFLINE',
  USER: 'USER',
  USER_DELETE: 'USER-DEL',
  USER_PASSWORD: 'USER-PWD',
  STORE: 'STORE',
  CUSTOMER: 'CUST',
  PRODUCT: 'PROD',
  CATEGORY: 'CAT',
  STOCK: 'STOCK',
  VOUCHER: 'VOUCH',
  LOGIN: 'LOGIN',
  VERIFY: 'VERIFY',
  SET_PASSWORD: 'SET-PWD',
  REQUEST_ACCESS: 'REQ-ACC',
  MARKETPLACE_ORDER: 'MKT-ORD',
  PURCHASE_ORDER: 'PO',
  IMAGE_UPLOAD: 'IMG',
  BARCODE: 'BARCODE',
  APP_UPDATE: 'APP',
  CART: 'CART',
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
