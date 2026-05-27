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

function settingsParams(storeId?: string | null) {
  if (storeId == null || storeId === "") return undefined;
  return { params: { storeId } };
}

export const settingsApi = {
  /** Pass storeId only for platform admin scoping; store admins use JWT store. */
  get: (storeId?: string | null) =>
    api.get<StoreSettingsResponse>("/settings", settingsParams(storeId)),

  patch: (data: PatchSettingsBody, storeId?: string | null) =>
    api.patch<StoreSettingsResponse>(
      "/settings",
      data,
      settingsParams(storeId)
    ),
};
