import type { SeedAuthSession, SeedData, VoucherRecord } from './types';

type MockApiOptions = {
  apiBaseUrl?: string;
  seedAuth: SeedAuthSession;
  seedData: SeedData;
};

type MockApiControls = {
  setOffline: (value: boolean) => void;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function paginate<T>(rows: T[], page = 1, limit = rows.length || 10): { data: T[]; meta: Meta } {
  const safeLimit = Math.max(1, Number(limit) || rows.length || 10);
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeLimit;
  const data = rows.slice(start, start + safeLimit);
  const total = rows.length;
  return {
    data,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

function isoNow() {
  return new Date().toISOString();
}

function isVoucherValid(voucher: VoucherRecord, cartTotal: number): { valid: boolean; message?: string } {
  if (!voucher.isActive) return { valid: false, message: 'Voucher is inactive.' };
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now()) {
    return { valid: false, message: 'Voucher has expired.' };
  }
  if (cartTotal < voucher.minPurchase) {
    return { valid: false, message: `Minimum purchase is R${voucher.minPurchase.toFixed(2)}.` };
  }
  if (voucher.maxUses != null && (voucher.currentUses ?? 0) >= voucher.maxUses) {
    return { valid: false, message: 'Voucher usage limit reached.' };
  }
  return { valid: true };
}

export function registerApiMocks(options: MockApiOptions): MockApiControls {
  const apiBaseUrl = options.apiBaseUrl ?? (Cypress.env('API_BASE_URL') as string) ?? 'http://localhost:3000';
  const state = {
    products: clone(options.seedData.products),
    categories: clone(options.seedData.categories),
    customers: clone(options.seedData.customers),
    transactions: clone(options.seedData.transactions),
    vouchers: clone(options.seedData.vouchers),
    stockAdjustments: clone(options.seedData.stockAdjustments),
    parcels: clone(options.seedData.parcels),
    marketplaceStores: clone(options.seedData.marketplaceStores),
    marketplaceOrders: clone(options.seedData.marketplaceOrders),
    offline: false,
  };

  const replyOfflineIfNeeded = (req: any) => {
    if (state.offline) {
      req.reply({ forceNetworkError: true });
      return true;
    }
    return false;
  };

  const productBelongsToCategory = (product: Record<string, unknown>, categoryName: string | undefined) => {
    if (!categoryName) return false;
    const raw = product.category;
    if (typeof raw === 'string') return raw === categoryName;
    if (raw && typeof raw === 'object' && raw !== null && 'name' in raw) {
      return String((raw as { name: string }).name) === categoryName;
    }
    const categoryId = product.categoryId as string | undefined;
    if (!categoryId) return false;
    const row = state.categories.find((c) => String(c.id) === String(categoryId));
    return row?.name === categoryName;
  };

  cy.intercept('HEAD', `${apiBaseUrl}`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: '' });
  });
  cy.intercept('GET', `${apiBaseUrl}`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: { ok: true } });
  });

  cy.intercept('GET', `${apiBaseUrl}/auth/profile`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: clone(options.seedAuth.user) });
  }).as('getAuthProfile');

  cy.intercept('GET', `${apiBaseUrl}/stores/my-store`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: clone(options.seedAuth.store) });
  }).as('getMyStore');
  cy.intercept('GET', `${apiBaseUrl}/stores/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: clone(options.seedAuth.store) });
  });
  cy.intercept('GET', `${apiBaseUrl}/settings*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: { credit: options.seedAuth.store.credit ?? null } });
  });

  cy.intercept('GET', `${apiBaseUrl}/categories*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: paginate(state.categories, Number(req.query.page ?? 1), Number(req.query.limit ?? 1000)) });
  }).as('getCategories');

  cy.intercept('POST', `${apiBaseUrl}/categories`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const now = isoNow();
    const created = {
      id: `cat-${Date.now()}`,
      name: String((req.body as { name?: string }).name ?? 'New Category'),
      storeId: options.seedAuth.store.id,
      createdAt: now,
      updatedAt: now,
    };
    state.categories.push(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createCategory');

  cy.intercept('PATCH', `${apiBaseUrl}/categories/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    const current = state.categories.find((row) => String(row.id) === id);
    if (!current) {
      req.reply({ statusCode: 404, body: { message: 'Category not found' } });
      return;
    }
    const updated = { ...current, ...(req.body as object), updatedAt: isoNow() };
    state.categories = state.categories.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('updateCategory');

  cy.intercept('DELETE', `${apiBaseUrl}/categories/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    const category = state.categories.find((row) => String(row.id) === id);
    const hasProducts = state.products.some((p) =>
      productBelongsToCategory(p as Record<string, unknown>, category?.name),
    );
    if (hasProducts) {
      req.reply({ statusCode: 400, body: { message: 'Cannot delete category with products.' } });
      return;
    }
    state.categories = state.categories.filter((row) => String(row.id) !== id);
    req.reply({ statusCode: 204, body: {} });
  }).as('deleteCategory');

  cy.intercept('GET', `${apiBaseUrl}/products*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    let rows = [...state.products];
    const querySearch = String(req.query.search ?? '').trim().toLowerCase();
    const queryCategoryId = String(req.query.categoryId ?? '').trim();
    if (querySearch) rows = rows.filter((row) => row.name.toLowerCase().includes(querySearch));
    if (queryCategoryId) {
      const category = state.categories.find((row) => String(row.id) === queryCategoryId);
      if (category) rows = rows.filter((row) => row.category === category.name);
    }
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 1000)) });
  }).as('getProducts');

  cy.intercept('POST', `${apiBaseUrl}/products`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const now = isoNow();
    const payload = req.body as Record<string, unknown>;
    const created = {
      id: `prod-${Date.now()}`,
      name: String(payload.name ?? 'New Product'),
      price: Number(payload.price ?? 0),
      costPrice: Number(payload.costPrice ?? 0),
      stock: Number(payload.stock ?? 0),
      category: String(payload.category ?? 'Uncategorized'),
      barcode: String(payload.barcode ?? ''),
      imageUrl: String(payload.imageUrl ?? ''),
      lowStockThreshold: Number(payload.lowStockThreshold ?? 0),
      storeId: options.seedAuth.store.id,
      createdAt: now,
      updatedAt: now,
    };
    state.products.push(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createProduct');

  cy.intercept('PATCH', `${apiBaseUrl}/products/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    const current = state.products.find((row) => String(row.id) === id);
    if (!current) {
      req.reply({ statusCode: 404, body: { message: 'Product not found' } });
      return;
    }
    const updated = { ...current, ...(req.body as object), updatedAt: isoNow() };
    state.products = state.products.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('updateProduct');

  cy.intercept('DELETE', `${apiBaseUrl}/products/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    state.products = state.products.filter((row) => String(row.id) !== id);
    req.reply({ statusCode: 204, body: {} });
  }).as('deleteProduct');

  cy.intercept('GET', `${apiBaseUrl}/customers*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const q = String(req.query.search ?? '').trim().toLowerCase();
    const rows = q
      ? state.customers.filter((row) => row.name.toLowerCase().includes(q) || row.contact.toLowerCase().includes(q))
      : state.customers;
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 1000)) });
  }).as('getCustomers');

  cy.intercept('POST', `${apiBaseUrl}/customers`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const now = isoNow();
    const payload = req.body as Record<string, unknown>;
    const created = {
      id: `cust-${Date.now()}`,
      name: String(payload.name ?? 'New Customer'),
      contact: String(payload.contact ?? ''),
      loyaltyPoints: Number(payload.loyaltyPoints ?? 0),
      storeId: options.seedAuth.store.id,
      createdAt: now,
      updatedAt: now,
    };
    state.customers.push(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createCustomer');

  cy.intercept('PATCH', `${apiBaseUrl}/customers/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop()?.split('?')[0]);
    const existing = state.customers.find((row) => String(row.id) === id);
    if (!existing) {
      req.reply({ statusCode: 404, body: { message: 'Customer not found' } });
      return;
    }
    const updated = { ...existing, ...(req.body as object), updatedAt: isoNow() };
    state.customers = state.customers.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('updateCustomer');

  cy.intercept('DELETE', `${apiBaseUrl}/customers/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop()?.split('?')[0]);
    state.customers = state.customers.filter((row) => String(row.id) !== id);
    req.reply({ statusCode: 204, body: {} });
  }).as('deleteCustomer');

  cy.intercept('GET', `${apiBaseUrl}/transactions*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    let rows = [...state.transactions];
    const search = String(req.query.search ?? '').toLowerCase();
    const date = String(req.query.date ?? '');
    if (search) rows = rows.filter((row) => row.id.toLowerCase().includes(search));
    if (date) rows = rows.filter((row) => String(row.createdAt ?? '').startsWith(date));
    rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 10)) });
  }).as('getTransactions');

  cy.intercept('POST', `${apiBaseUrl}/transactions`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as {
      customerId?: string;
      items: Array<{ productId: string; quantity: number; totalPrice: number; productName: string; unitPrice: number; imageUrl?: string }>;
      total: number;
      paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Credit';
      voucherCode?: string;
      discountAmount?: number;
      storeId: string;
    };

    const created = {
      id: `txn-${Date.now()}`,
      customerId: payload.customerId ?? null,
      items: payload.items,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      voucherCode: payload.voucherCode ?? null,
      discountAmount: payload.discountAmount ?? null,
      storeId: payload.storeId,
      createdAt: isoNow(),
    };
    state.transactions.unshift(created);

    for (const item of payload.items) {
      state.products = state.products.map((row) => {
        if (String(row.id) !== String(item.productId)) return row;
        return { ...row, stock: Math.max(0, Number(row.stock) - Number(item.quantity)), updatedAt: isoNow() };
      });
    }

    if (payload.customerId) {
      state.customers = state.customers.map((row) =>
        String(row.id) === String(payload.customerId)
          ? { ...row, loyaltyPoints: Number(row.loyaltyPoints) + Math.max(1, Math.floor(Number(payload.total) / 10)), updatedAt: isoNow() }
          : row,
      );
    }

    req.reply({ statusCode: 201, body: created });
  }).as('createTransaction');

  cy.intercept('GET', `${apiBaseUrl}/vouchers*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const isActiveParam = req.query.isActive;
    let rows = [...state.vouchers];
    if (typeof isActiveParam !== 'undefined') {
      rows = rows.filter((row) => row.isActive === (String(isActiveParam) === 'true'));
    }
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 20)) });
  }).as('getVouchers');

  cy.intercept('POST', `${apiBaseUrl}/vouchers`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as Record<string, unknown>;
    const created = {
      id: `vouch-${Date.now()}`,
      code: String(payload.code ?? '').toUpperCase(),
      type: String(payload.type ?? 'percentage') as 'percentage' | 'fixed',
      value: Number(payload.value ?? 0),
      minPurchase: Number(payload.minPurchase ?? 0),
      isActive: Boolean(payload.isActive ?? true),
      expiresAt: (payload.expiresAt as string | null | undefined) ?? null,
      maxUses: (payload.maxUses as number | null | undefined) ?? null,
      maxUsesPerCustomer: (payload.maxUsesPerCustomer as number | null | undefined) ?? null,
      currentUses: 0,
      storeId: options.seedAuth.store.id,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    state.vouchers.push(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createVoucher');

  cy.intercept('PATCH', `${apiBaseUrl}/vouchers/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    const existing = state.vouchers.find((row) => String(row.id) === id);
    if (!existing) {
      req.reply({ statusCode: 404, body: { message: 'Voucher not found' } });
      return;
    }
    const updated = { ...existing, ...(req.body as object), updatedAt: isoNow() };
    state.vouchers = state.vouchers.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('updateVoucher');

  cy.intercept('DELETE', `${apiBaseUrl}/vouchers/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    state.vouchers = state.vouchers.filter((row) => String(row.id) !== id);
    req.reply({ statusCode: 204, body: {} });
  }).as('deleteVoucher');

  cy.intercept('POST', `${apiBaseUrl}/vouchers/validate`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as { code: string; cartTotal: number };
    const voucher = state.vouchers.find((row) => row.code.toUpperCase() === String(payload.code ?? '').toUpperCase());
    if (!voucher) {
      req.reply({ statusCode: 200, body: { valid: false, message: 'Voucher code is invalid.' } });
      return;
    }

    const validity = isVoucherValid(voucher, Number(payload.cartTotal));
    if (!validity.valid) {
      req.reply({ statusCode: 200, body: { valid: false, message: validity.message } });
      return;
    }

    const discountAmount =
      voucher.type === 'percentage'
        ? Math.round((Number(payload.cartTotal) * voucher.value) / 100 * 100) / 100
        : Math.min(Number(payload.cartTotal), voucher.value);
    req.reply({
      statusCode: 200,
      body: {
        valid: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          type: voucher.type,
          value: voucher.value,
        },
        discountAmount,
      },
    });
  }).as('validateVoucher');

  cy.intercept('GET', `${apiBaseUrl}/stock-adjustments*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    req.reply({ statusCode: 200, body: paginate(state.stockAdjustments, Number(req.query.page ?? 1), Number(req.query.limit ?? 50)) });
  }).as('getStockAdjustments');

  cy.intercept('GET', `${apiBaseUrl}/stock-adjustments/product/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const productId = String(req.url.split('/').pop());
    req.reply({ statusCode: 200, body: state.stockAdjustments.filter((row) => String(row.productId) === productId) });
  }).as('getStockAdjustmentsByProduct');

  cy.intercept('POST', `${apiBaseUrl}/stock-adjustments`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as { productId: string; newStock: number; reason: string; note?: string };
    const product = state.products.find((row) => String(row.id) === String(payload.productId));
    const adjustment = {
      id: `adj-${Date.now()}`,
      productId: String(payload.productId),
      productName: product?.name ?? 'Unknown Product',
      oldStock: Number(product?.stock ?? 0),
      newStock: Number(payload.newStock),
      reason: payload.reason,
      note: payload.note ?? null,
      storeId: options.seedAuth.store.id,
      createdAt: isoNow(),
    };
    state.stockAdjustments.unshift(adjustment);
    if (product) {
      state.products = state.products.map((row) =>
        String(row.id) === String(payload.productId) ? { ...row, stock: Number(payload.newStock), updatedAt: isoNow() } : row,
      );
    }
    req.reply({ statusCode: 201, body: adjustment });
  }).as('createStockAdjustment');

  cy.intercept('GET', `${apiBaseUrl}/parcels*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const status = String(req.query.status ?? '');
    const search = String(req.query.search ?? '').toLowerCase();
    let rows = [...state.parcels];
    if (status) rows = rows.filter((row) => row.status === status);
    if (search) {
      rows = rows.filter(
        (row) =>
          row.deliveryNumber.toLowerCase().includes(search) ||
          String(row.collectionCode ?? '').toLowerCase().includes(search),
      );
    }
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 50)) });
  }).as('getParcels');

  cy.intercept('POST', `${apiBaseUrl}/parcels`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as { storeId: string; deliveryNumber: string; customerName: string };
    const now = isoNow();
    const created = {
      id: `parcel-${Date.now()}`,
      storeId: payload.storeId,
      deliveryNumber: payload.deliveryNumber,
      customerName: payload.customerName,
      status: 'Incoming' as const,
      collectionCode: null,
      receiptCode: null,
      dateReceived: null,
      dateCollected: null,
      collectingPersonName: null,
      collectingPersonPhone: null,
      collectingPersonId: null,
      createdAt: now,
      updatedAt: now,
    };
    state.parcels.push(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createParcel');

  cy.intercept('POST', `${apiBaseUrl}/parcels/*/receive`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').slice(-2)[0]);
    const payload = req.body as { receiptCode: string };
    const now = isoNow();
    const existing = state.parcels.find((row) => String(row.id) === id);
    if (!existing) {
      req.reply({ statusCode: 404, body: { message: 'Parcel not found' } });
      return;
    }
    const updated = {
      ...existing,
      status: 'Received' as const,
      receiptCode: payload.receiptCode,
      collectionCode: existing.collectionCode ?? `COLL-${Math.floor(Math.random() * 9000 + 1000)}`,
      dateReceived: now,
      updatedAt: now,
    };
    state.parcels = state.parcels.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('receiveParcel');

  cy.intercept('POST', `${apiBaseUrl}/parcels/*/collect`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').slice(-2)[0]);
    const payload = req.body as {
      collectionCode: string;
      collectingPersonName: string;
      collectingPersonId: string;
      collectingPersonPhone?: string;
    };
    const now = isoNow();
    const existing = state.parcels.find((row) => String(row.id) === id);
    if (!existing) {
      req.reply({ statusCode: 404, body: { message: 'Parcel not found' } });
      return;
    }
    if (String(existing.collectionCode ?? '') !== String(payload.collectionCode)) {
      req.reply({ statusCode: 400, body: { message: 'Collection code does not match.' } });
      return;
    }
    const updated = {
      ...existing,
      status: 'Collected' as const,
      collectingPersonName: payload.collectingPersonName,
      collectingPersonId: payload.collectingPersonId,
      collectingPersonPhone: payload.collectingPersonPhone ?? null,
      dateCollected: now,
      updatedAt: now,
    };
    state.parcels = state.parcels.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('collectParcel');

  cy.intercept('PATCH', `${apiBaseUrl}/parcels/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    const existing = state.parcels.find((row) => String(row.id) === id);
    if (!existing) {
      req.reply({ statusCode: 404, body: { message: 'Parcel not found' } });
      return;
    }
    const updated = { ...existing, ...(req.body as object), updatedAt: isoNow() };
    state.parcels = state.parcels.map((row) => (String(row.id) === id ? updated : row));
    req.reply({ statusCode: 200, body: updated });
  }).as('updateParcel');

  cy.intercept('DELETE', `${apiBaseUrl}/parcels/*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const id = String(req.url.split('/').pop());
    state.parcels = state.parcels.filter((row) => String(row.id) !== id);
    req.reply({ statusCode: 204, body: {} });
  }).as('deleteParcel');

  cy.intercept('GET', `${apiBaseUrl}/marketplace-stores*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const activeOnly = String(req.query.activeOnly ?? 'false') === 'true';
    const rows = activeOnly ? state.marketplaceStores.filter((row) => row.isActive) : state.marketplaceStores;
    req.reply({ statusCode: 200, body: rows });
  }).as('getMarketplaceStores');

  cy.intercept('GET', `${apiBaseUrl}/marketplace-orders/search*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const code = String(req.query.code ?? '').toUpperCase();
    const found = state.marketplaceOrders.find((row) => row.orderCode.toUpperCase() === code);
    if (!found) {
      req.reply({ statusCode: 404, body: { message: 'Order not found' } });
      return;
    }
    req.reply({ statusCode: 200, body: found });
  }).as('searchMarketplaceOrder');

  cy.intercept('GET', `${apiBaseUrl}/marketplace-orders*`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    let rows = [...state.marketplaceOrders];
    const search = String(req.query.search ?? '').toUpperCase();
    const marketplaceStoreId = String(req.query.marketplaceStoreId ?? '');
    if (search) rows = rows.filter((row) => row.orderCode.toUpperCase().includes(search));
    if (marketplaceStoreId) rows = rows.filter((row) => row.marketplaceStoreId === marketplaceStoreId);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    req.reply({ statusCode: 200, body: paginate(rows, Number(req.query.page ?? 1), Number(req.query.limit ?? 20)) });
  }).as('getMarketplaceOrders');

  cy.intercept('POST', `${apiBaseUrl}/marketplace-orders`, (req) => {
    if (replyOfflineIfNeeded(req)) return;
    const payload = req.body as {
      marketplaceStoreId: string;
      storeId: string;
      customerId?: string;
      items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; imageUrl?: string }>;
      subtotal: number;
      vatAmount?: number;
      serviceFee?: number;
      total: number;
      paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
    };
    const now = isoNow();
    const created = {
      id: `mkt-order-${Date.now()}`,
      orderCode: `MK-${Math.floor(Math.random() * 90000 + 10000)}`,
      marketplaceStoreId: payload.marketplaceStoreId,
      storeId: payload.storeId,
      customerId: payload.customerId ?? null,
      items: payload.items,
      subtotal: payload.subtotal,
      vatAmount: payload.vatAmount ?? 0,
      serviceFee: payload.serviceFee ?? 0,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };
    state.marketplaceOrders.unshift(created);
    req.reply({ statusCode: 201, body: created });
  }).as('createMarketplaceOrder');

  return {
    setOffline(value: boolean) {
      state.offline = value;
    },
  };
}

