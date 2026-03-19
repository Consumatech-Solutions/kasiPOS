/**
 * Store settings API – GET/PATCH /settings.
 * Used for store-level config such as customer credit (limit, term type, term days).
 *
 * The frontend passes storeId = currentUser.storeId ?? currentStore.id (JWT first) so the
 * backend (which uses req.user.storeId ?? storeIdQuery) and frontend agree on the same store.
 */
import { api } from './core';
import type { StoreCreditSetting } from '@/types';

export interface StoreSettingsResponse {
  credit?: StoreCreditSetting | null;
  [key: string]: unknown;
}

export interface PatchSettingsBody {
  credit?: StoreCreditSetting | null;
  [key: string]: unknown;
}

export const settingsApi = {
  /**
   * GET /settings?storeId=<uuid>
   * Backend should use this storeId so the same store is used at checkout.
   */
  get: (storeId?: string | null) =>
    api.get<StoreSettingsResponse>('/settings', {
      ...(storeId != null && storeId !== '' && { params: { storeId } }),
    }),

  /**
   * PATCH /settings?storeId=<uuid>
   * Backend must persist to this storeId (not only JWT storeId) so credit is configured for the store we sell in.
   */
  patch: (data: PatchSettingsBody, storeId?: string | null) =>
    api.patch<StoreSettingsResponse>('/settings', data, {
      ...(storeId != null && storeId !== '' && { params: { storeId } }),
    }),
};
