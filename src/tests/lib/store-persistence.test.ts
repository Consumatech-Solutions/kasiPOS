import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getMyStoreMock = vi.fn();
const settingsGetMock = vi.fn();

vi.mock('@/lib/api/stores', () => ({
  storesApi: {
    getMyStore: () => getMyStoreMock(),
  },
}));

vi.mock('@/lib/api/settings', () => ({
  settingsApi: {
    get: () => settingsGetMock(),
  },
}));

import { getDb, resetDbInstanceForTests } from '@/lib/db';
import {
  saveStorePermanently,
  loadStoreFromIndexedDB,
  fetchAndSaveStore,
} from '@/lib/store-persistence';
import type { Store } from '@/types';

const baseStore: Store = {
  id: 'store-uuid-1',
  name: 'Test Store',
  vatNumber: null,
  logoUrl: null,
  receiptHeader: null,
  receiptFooter: null,
  isSetupComplete: true,
  ownerId: 'owner-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('store-persistence', () => {
  beforeEach(async () => {
    globalThis.localStorage.clear();
    await resetDbInstanceForTests();
    getMyStoreMock.mockReset();
    settingsGetMock.mockReset();
    settingsGetMock.mockRejectedValue(new Error('settings unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbInstanceForTests();
  });

  it('saveStorePermanently calls setSetting and writes synced store to IndexedDB', async () => {
    const setSetting = vi.fn();
    await saveStorePermanently(baseStore, setSetting);
    expect(setSetting).toHaveBeenCalledWith('currentStore', baseStore);
    const row = await getDb().stores.get(baseStore.id);
    expect(row?.synced).toBe(true);
    expect(row?.lastSyncedAt).toBeDefined();
    expect(row?.name).toBe('Test Store');
  });

  it('saveStorePermanently falls back to localStorage when setSetting omitted', async () => {
    await saveStorePermanently(baseStore);
    const raw = globalThis.localStorage.getItem('kasi-pos-settings');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.currentStore?.id).toBe(baseStore.id);
  });

  it('loadStoreFromIndexedDB returns store by id or first store', async () => {
    await saveStorePermanently(baseStore);
    const byId = await loadStoreFromIndexedDB(baseStore.id);
    expect(byId?.id).toBe(baseStore.id);
    const first = await loadStoreFromIndexedDB();
    expect(first?.id).toBe(baseStore.id);
  });

  it('fetchAndSaveStore returns store from API and merges settings credit when present', async () => {
    const setSetting = vi.fn();
    const credit = {
      customerCredit: { creditLimit: 100, termType: 'fixed' as const, term: 7 },
    };
    getMyStoreMock.mockResolvedValue({ data: baseStore });
    settingsGetMock.mockResolvedValue({ data: { credit } });
    const result = await fetchAndSaveStore(setSetting);
    expect(result?.id).toBe(baseStore.id);
    expect(result?.credit).toEqual(credit);
    expect(setSetting).toHaveBeenCalled();
  });

  it('fetchAndSaveStore falls back to IndexedDB on network failure', async () => {
    const setSetting = vi.fn();
    await saveStorePermanently(baseStore, setSetting);
    setSetting.mockClear();
    getMyStoreMock.mockRejectedValue(
      Object.assign(new Error('Network Error'), {
        isNetworkError: true,
      })
    );
    const result = await fetchAndSaveStore(setSetting, baseStore.id);
    expect(result?.id).toBe(baseStore.id);
    expect(setSetting).toHaveBeenCalledWith('currentStore', expect.objectContaining({ id: baseStore.id }));
  });
});
