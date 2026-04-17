/**
 * Registry to re-execute queued mutations after page reload.
 * Maps mutationKey + variables to the actual API call (mutationFn cannot be serialized to Dexie).
 */
import {
  transactionsApi,
  toCreateTransactionDto,
  type CreateTransactionDto,
  type CreateTransactionItemDto,
} from "@/lib/api/transactions";
import { catalogueApi } from "@/lib/api/catalogue";
import type { ApiCategory } from "@/types/catalogue";
import { customersApi } from "@/lib/api/customers";
import type { CreateCustomerDto } from "@/types";
import { stockAdjustmentsApi } from "@/lib/api/stock-adjustments";
import {
  purchaseOrdersApi,
  type CreatePurchaseOrderDto,
} from "@/lib/api/purchase-orders";
import { vouchersApi } from "@/lib/api/vouchers";
import { parcelsApi } from "@/lib/api/parcels";
import { usersApi } from "@/lib/api/users";
import { settingsApi, type PatchSettingsBody } from "@/lib/api/settings";
import { getDb } from "@/lib/db";

const DELIVERY_FEE = 150;

async function resolveCategoryId(categoryName: string): Promise<string> {
  const categoriesResp = await catalogueApi.categories.getAll();
  const categories: ApiCategory[] = Array.isArray(categoriesResp)
    ? categoriesResp
    : ((categoriesResp as { data?: ApiCategory[] })?.data ?? []);
  const category = categories.find((c) => c.name === categoryName);
  if (!category) throw new Error(`Category "${categoryName}" not found`);
  return category.id;
}

function normalizeProductPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
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

export async function executeMutation(
  mutationKey: string[],
  variables: unknown,
): Promise<unknown> {
  const [type, action] = mutationKey;
  if (!type || !action)
    throw new Error(`Invalid mutation key: ${mutationKey.join("/")}`);

  switch (`${type}/${action}`) {
    case "transactions/create": {
      const raw = variables as Parameters<typeof toCreateTransactionDto>[0] & {
        items?: Array<{
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          imageUrl?: string;
        }>;
        customerId?: string;
        idempotencyKey?: string;
      };
      const mappings = await getDb().syncIdMapping.toArray();
      const map = new Map(mappings.map((m) => [m.tempId, m.serverId]));

      const resolvedItems: CreateTransactionItemDto[] | undefined =
        raw.items?.map((item) => ({
          productId: map.get(String(item.productId)) ?? String(item.productId),
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          ...(item.imageUrl != null && { imageUrl: item.imageUrl }),
        }));
      const resolvedCustomerId =
        raw.customerId && String(raw.customerId).startsWith("temp-")
          ? (map.get(String(raw.customerId)) ?? raw.customerId)
          : raw.customerId;
      const resolved = resolvedItems
        ? { ...raw, items: resolvedItems, customerId: resolvedCustomerId }
        : { ...raw, customerId: resolvedCustomerId };
      const dto = toCreateTransactionDto(
        resolved as Parameters<typeof toCreateTransactionDto>[0],
      );
      const idempotencyKey = raw.idempotencyKey;
      // Cast: toCreateTransactionDto return type can be inferred as unknown[] for items by TS in some configs
      return transactionsApi.create(dto as unknown as CreateTransactionDto, {
        idempotencyKey,
      });
    }

    case "products/create": {
      const productData = { ...(variables as Record<string, unknown>) };
      const _tempId = productData._tempId as string | undefined;
      delete productData._tempId;
      const categoryId =
        productData.categoryId ??
        (await resolveCategoryId(String(productData.category ?? "")));
      const result = await catalogueApi.products.create({
        ...normalizeProductPayload(productData),
        categoryId,
        ...(_tempId && { _tempId }),
      } as Parameters<typeof catalogueApi.products.create>[0]);
      if (_tempId && result?.id) {
        await getDb().syncIdMapping.put({
          tempId: _tempId,
          serverId: String(result.id),
          createdAt: Date.now(),
        });
      }
      return result;
    }

    case "products/update": {
      const { id, data } = variables as {
        id: string;
        data: Record<string, unknown>;
      };
      let updatePayload = normalizeProductPayload(data);
      if (data?.category != null && data?.categoryId == null) {
        updatePayload = {
          ...updatePayload,
          categoryId: await resolveCategoryId(String(data.category)),
        };
      }
      return catalogueApi.products.update(
        id,
        updatePayload as Parameters<typeof catalogueApi.products.update>[1],
      );
    }

    case "products/delete": {
      const { id } = variables as { id: string };
      return catalogueApi.products.delete(id);
    }

    case "categories/create":
      return catalogueApi.categories.create(
        variables as Parameters<typeof catalogueApi.categories.create>[0],
      );

    case "categories/update": {
      const catUpdate = variables as {
        id: string;
        data: Parameters<typeof catalogueApi.categories.update>[1];
      };
      return catalogueApi.categories.update(catUpdate.id, catUpdate.data);
    }

    case "categories/delete": {
      const { id } = variables as { id: string };
      return catalogueApi.categories.delete(id);
    }

    case "customers/create": {
      const custData = variables as CreateCustomerDto & { _tempId?: string };
      const _tempId = custData._tempId;
      const payload: CreateCustomerDto = {
        name: custData.name,
        contact: custData.contact,
        ...(custData.loyaltyPoints != null && {
          loyaltyPoints: custData.loyaltyPoints,
        }),
        ...(custData.storeId != null &&
          custData.storeId !== "" && { storeId: custData.storeId }),
        ...(_tempId && { _tempId }),
      };
      const result = await customersApi.create(payload);
      if (_tempId && result?.data?.id) {
        await getDb().syncIdMapping.put({
          tempId: _tempId,
          serverId: String(result.data.id),
          createdAt: Date.now(),
        });
      }
      return result;
    }

    case "customers/update": {
      const custUpdate = variables as {
        id: string;
        data: Parameters<typeof customersApi.update>[1];
      };
      return customersApi.update(custUpdate.id, custUpdate.data);
    }

    case "customers/delete": {
      const { id } = variables as { id: string };
      return customersApi.delete(id);
    }

    case "stockAdjustments/create": {
      const adj = variables as {
        productId: string;
        newStock: number;
        reason: string;
        note?: string;
      };
      const mappings = await getDb().syncIdMapping.toArray();
      const map = new Map(mappings.map((m) => [m.tempId, m.serverId]));
      const resolvedProductId = map.get(String(adj.productId)) ?? adj.productId;
      return stockAdjustmentsApi.create({
        productId: resolvedProductId,
        newStock: adj.newStock,
        reason: adj.reason as Parameters<
          typeof stockAdjustmentsApi.create
        >[0]["reason"],
        note: adj.note,
      });
    }

    case "purchaseOrders/create": {
      const v = variables as {
        cart: CreatePurchaseOrderDto["items"];
        subtotal: number;
        total: number;
        deliveryMethod: "delivery" | "collection";
      };
      return purchaseOrdersApi.create({
        items: v.cart,
        subtotal: v.subtotal,
        deliveryFee: v.deliveryMethod === "delivery" ? DELIVERY_FEE : 0,
        total: v.total,
        deliveryMethod: v.deliveryMethod,
      });
    }

    case "purchaseOrders/updateStatus": {
      const v = variables as {
        id: string;
        status: "pending" | "completed" | "cancelled";
      };
      return purchaseOrdersApi.updateStatus(v.id, { status: v.status });
    }

    case "vouchers/create":
      return vouchersApi.create(
        variables as Parameters<typeof vouchersApi.create>[0],
      );

    case "vouchers/update": {
      const vUp = variables as {
        id: string;
        data: Parameters<typeof vouchersApi.update>[1];
      };
      return vouchersApi.update(vUp.id, vUp.data);
    }

    case "vouchers/delete": {
      const { id } = variables as { id: string };
      return vouchersApi.delete(id);
    }

    case "parcels/create":
      return parcelsApi.create(
        variables as Parameters<typeof parcelsApi.create>[0],
      );

    case "users/create":
      return usersApi.create(
        variables as Parameters<typeof usersApi.create>[0],
      );

    case "users/update": {
      const uUp = variables as { id: string; data: Record<string, unknown> };
      return usersApi.update(uUp.id, uUp.data);
    }

    case "users/delete": {
      const { id } = variables as { id: string };
      return usersApi.remove(id);
    }

    case "settings/patch": {
      const v = variables as {
        storeId?: string | null;
        body: PatchSettingsBody;
      };
      return settingsApi.patch(v.body, v.storeId);
    }

    default:
      throw new Error(`Unknown mutation: ${type}/${action}`);
  }
}
