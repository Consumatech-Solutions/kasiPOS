"use client";

import dynamic from "next/dynamic";

const DbProvider = dynamic(() => import("@/components/db-provider"), {
  ssr: false,
  loading: () => null,
});

export function ClientDbProvider({ children }: { children: React.ReactNode }) {
  return <DbProvider>{children}</DbProvider>;
}
