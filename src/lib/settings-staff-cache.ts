import { getDb } from '@/lib/db';
import type { User } from '@/types';

function cacheKey(storeId: string, page: number): string {
  return `settings_staff:${storeId}:${page}`;
}

export interface StaffPageCache {
  users: User[];
  totalPages: number;
  updatedAt: number;
}

export async function writeStaffPageCache(
  storeId: string,
  page: number,
  users: User[],
  totalPages: number
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const payload: StaffPageCache = { users, totalPages, updatedAt: Date.now() };
  await db.keyVal.put({ key: cacheKey(storeId, page), value: JSON.stringify(payload) });
}

export async function readStaffPageCache(storeId: string, page: number): Promise<StaffPageCache | null> {
  if (typeof window === 'undefined') return null;
  const db = getDb();
  const row = await db.keyVal.get(cacheKey(storeId, page));
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as StaffPageCache;
  } catch {
    return null;
  }
}
