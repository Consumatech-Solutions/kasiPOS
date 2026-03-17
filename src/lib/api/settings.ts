/**
 * Store settings API – GET/PATCH /settings.
 * Used for store-level config such as customer credit (limit, term type, term days).
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
  get: () => api.get<StoreSettingsResponse>('/settings'),

  patch: (data: PatchSettingsBody) => api.patch<StoreSettingsResponse>('/settings', data),
};
