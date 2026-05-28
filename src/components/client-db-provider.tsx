"use client";

import DbProvider from "@/components/db-provider";

export function ClientDbProvider({ children }: { children: React.ReactNode }) {
  return <DbProvider>{children}</DbProvider>;
}
