/**
 * Registry to re-execute queued mutations after page reload.
 * Maps mutationKey + variables to the actual API call (mutationFn cannot be serialized to localStorage).
 */
import { transactionsApi, toCreateTransactionDto } from '@/lib/api/transactions';
import { catalogueApi } from '@/lib/api/catalogue';
import type { ApiCategory } from '@/types/catalogue';
import { customersApi } from '@/lib/api/customers';
import { stockAdjustmentsApi } from '@/lib/api/stock-adjustments';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { vouchersApi } from '@/lib/api/vouchers';
import { parcelsApi } from '@/lib/api/parcels';
import { usersApi } from '@/lib/api/users';

const DELIVERY_FEE = 150;

async function resolveCategoryId(categoryName: string): Promise<string> {
  const categoriesResp = await catalogueApi.categories.getAll();
  const categories: ApiCategory[] = Array.isArray(categoriesResp)
    ? categoriesResp
    : (categoriesResp as { data?: ApiCategory[] })?.data ?? [];
  const category = categories.find((c) => c.name === categoryName);
  if (!category) throw new Error(`Category "${categoryName}" not found`);
  return category.id;
}

function normalizeProductPayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: data.name,
    price: data.price,
    costPrice: data.costPrice,
    stock: data.stock,
    barCode: data.barCode ?? data.barcode,
    productImage: data.imageUrl ?? data.productImage,
  };
  if (data.categoryId != null) {
    out.categoryId = data.categoryId;
  }
  return out;
}

export async function executeMutation(mutationKey: string[], variables: unknown): Promise<unknown> {
  const [type, action] = mutationKey;
  if (!type || !action) throw new Error(`Invalid mutation key: ${mutationKey.join('/')}`);

  switch (`${type}/${action}`) {
    case 'transactions/create': {
      return transactionsApi.create(toCreateTransactionDto(variables as Parameters<typeof toCreateTransactionDto>[0]));
    }

    case 'products/create': {
      const productData = variables as Record<string, unknown>;
      const categoryId = productData.categoryId ?? (await resolveCategoryId(String(productData.category ?? '')));
      return catalogueApi.products.create({
        ...normalizeProductPayload(productData),
        categoryId,
      } as Parameters<typeof catalogueApi.products.create>[0]);
    }

    case 'products/update': {
      const { id, data } = variables as { id: string; data: Record<string, unknown> };
      let updatePayload = normalizeProductPayload(data);
      if (data?.category != null && data?.categoryId == null) {
        updatePayload = { ...updatePayload, categoryId: await resolveCategoryId(String(data.category)) };
      }
      return catalogueApi.products.update(id, updatePayload as Parameters<typeof catalogueApi.products.update>[1]);
    }

    case 'products/delete': {
      const { id } = variables as { id: string };
      return catalogueApi.products.delete(id);
    }

    case 'categories/create':
      return catalogueApi.categories.create(variables as Parameters<typeof catalogueApi.categories.create>[0]);

    case 'categories/update': {
      const catUpdate = variables as { id: string; data: Parameters<typeof catalogueApi.categories.update>[1] };
      return catalogueApi.categories.update(catUpdate.id, catUpdate.data);
    }

    case 'categories/delete': {
      const { id } = variables as { id: string };
      return catalogueApi.categories.delete(id);
    }

    case 'customers/create':
      return customersApi.create(variables as Parameters<typeof customersApi.create>[0]);

    case 'customers/update': {
      const custUpdate = variables as { id: string; data: Parameters<typeof customersApi.update>[1] };
      return customersApi.update(custUpdate.id, custUpdate.data);
    }

    case 'customers/delete': {
      const { id } = variables as { id: string };
      return customersApi.delete(id);
    }

    case 'stockAdjustments/create': {
      const adj = variables as { productId: string; newStock: number; reason: string; note?: string };
      return stockAdjustmentsApi.create({
        productId: adj.productId,
        newStock: adj.newStock,
        reason: adj.reason as Parameters<typeof stockAdjustmentsApi.create>[0]['reason'],
        note: adj.note,
      });
    }

    case 'purchaseOrders/create': {
      const v = variables as { cart: unknown[]; subtotal: number; total: number; deliveryMethod: 'delivery' | 'collection' };
      return purchaseOrdersApi.create({
        items: v.cart,
        subtotal: v.subtotal,
        deliveryFee: v.deliveryMethod === 'delivery' ? DELIVERY_FEE : 0,
        total: v.total,
        deliveryMethod: v.deliveryMethod,
      });
    }

    case 'vouchers/create':
      return vouchersApi.create(variables as Parameters<typeof vouchersApi.create>[0]);

    case 'vouchers/update': {
      const vUp = variables as { id: string; data: Parameters<typeof vouchersApi.update>[1] };
      return vouchersApi.update(vUp.id, vUp.data);
    }

    case 'vouchers/delete': {
      const { id } = variables as { id: string };
      return vouchersApi.delete(id);
    }

    case 'parcels/create':
      return parcelsApi.create(variables as Parameters<typeof parcelsApi.create>[0]);

    case 'users/create':
      return usersApi.create(variables as Parameters<typeof usersApi.create>[0]);

    case 'users/update': {
      const uUp = variables as { id: string; data: Record<string, unknown> };
      return usersApi.update(uUp.id, uUp.data);
    }

    case 'users/delete': {
      const { id } = variables as { id: string };
      return usersApi.remove(id);
    }

    default:
      throw new Error(`Unknown mutation: ${type}/${action}`);
  }
}
