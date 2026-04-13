/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

describe('getDb', () => {
  it('throws when window is undefined (server)', async () => {
    const { getDb } = await import('@/lib/db');
    expect(() => getDb()).toThrow('Database can only be accessed on the client side');
  });
});
