'use client';

import dynamic from 'next/dynamic';

// Load DbProvider dynamically (client-only) to avoid ChunkLoadError with Dexie/IndexedDB on server.
// Use default export so RSC client and webpack chunk share the same module contract (avoids factory undefined).
const DbProvider = dynamic(() => import('@/components/db-provider'), {
  ssr: false,
  loading: () => null,
});

export function ClientDbProvider({ children }: { children: React.ReactNode }) {
  return <DbProvider>{children}</DbProvider>;
}
