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

function settingsQueryParams(storeId?: string | null) {
  if (storeId == null || storeId === "") return undefined;
  return { storeId: String(storeId) };
}

export const settingsApi = {
  /** Pass storeId only for platform admin; store admins use JWT store scope. */
  get: (storeId?: string | null) =>
    api.get<StoreSettingsResponse>("/settings", {
      params: settingsQueryParams(storeId),
    }),

  patch: (data: PatchSettingsBody, storeId?: string | null) =>
    api.patch<StoreSettingsResponse>("/settings", data, {
      params: settingsQueryParams(storeId),
    }),
};
