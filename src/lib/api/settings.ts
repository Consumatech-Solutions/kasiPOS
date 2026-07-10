import { api } from "./core";
import type { StoreCreditSetting, StoreCurrency } from "@/types";

export interface StoreSettings {
  storeId: string;
  vatIncludedInPrice: boolean;
  currency: StoreCurrency;
  cdfUsdExRate: number | null;
  zarUsdExRate: number | null;
  credit?: StoreCreditSetting | null;
  updatedAt: string;
}

export interface UpdateStoreSettingsDto {
  vatIncludedInPrice?: boolean;
  currency?: StoreCurrency;
  cdfUsdExRate?: number | null;
  zarUsdExRate?: number | null;
  credit?: StoreCreditSetting | null;
}

/** @deprecated Use StoreSettings */
export type StoreSettingsResponse = StoreSettings;

/** @deprecated Use UpdateStoreSettingsDto */
export type PatchSettingsBody = UpdateStoreSettingsDto;

export function normalizeStoreSettings(raw: unknown): StoreSettings | null {
  if (raw == null || typeof raw !== "object") return null;
  const body =
    "data" in (raw as object) && (raw as { data?: unknown }).data != null
      ? (raw as { data: StoreSettings }).data
      : (raw as StoreSettings);
  if (!body || typeof body !== "object" || !("storeId" in body)) return null;
  return body;
}

export const settingsApi = {
  get: (storeId?: string | null) =>
    api.get<StoreSettings>("/settings", {
      ...(storeId != null && storeId !== "" && { params: { storeId } }),
    }),

  patch: (data: UpdateStoreSettingsDto, storeId?: string | null) =>
    api.patch<StoreSettings>("/settings", data, {
      ...(storeId != null && storeId !== "" && { params: { storeId } }),
    }),
};
