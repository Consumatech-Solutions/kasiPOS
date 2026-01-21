'use client';

import dynamic from 'next/dynamic';

// Charger DbProvider dynamiquement (côté client uniquement)
// Cela évite les problèmes de ChunkLoadError avec Dexie/IndexedDB côté serveur
const DbProvider = dynamic(
  () => import('@/components/db-provider').then((mod) => mod.DbProvider),
  {
    ssr: false, // Désactiver le rendu côté serveur
  }
);

export function ClientDbProvider({ children }: { children: React.ReactNode }) {
  return <DbProvider>{children}</DbProvider>;
}
