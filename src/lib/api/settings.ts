import { api } from "./core";
import type { StoreCreditSetting } from "@/types";

export interface StoreSettingsResponse {
  credit?: StoreCreditSetting | null;
  [key: string]: unknown;
}

export interface PatchSettingsBody {
  credit?: StoreCreditSetting | null;
  [key: string]: unknown;
}

export const settingsApi = {
  get: (storeId?: string | null) =>
    api.get<StoreSettingsResponse>("/settings", {
      ...(storeId != null && storeId !== "" && { params: { storeId } }),
    }),

  patch: (data: PatchSettingsBody, storeId?: string | null) =>
    api.patch<StoreSettingsResponse>("/settings", data, {
      ...(storeId != null && storeId !== "" && { params: { storeId } }),
    }),
};
