"use client";

import Link from "next/link";
import { useState } from "react";
import { Store } from "lucide-react";
import type { Store as StoreType } from "@/types";

type HeaderBrandProps = {
  pageTitle: string;
  PageIcon: React.ElementType;
  currentStore: StoreType | null | undefined;
};

export function HeaderBrand({
  pageTitle,
  PageIcon,
  currentStore,
}: HeaderBrandProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
      <Link href="/" className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {!logoError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png"
            alt="kasiPOS"
            className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="bg-green-500 p-1.5 sm:p-2 rounded-md">
            <Store className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
        )}
        <span className="text-base sm:text-lg font-bold hidden sm:inline">
          kasiPOS
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-2 text-muted-foreground">
        <div className="h-6 w-px bg-border" />
        <PageIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{pageTitle}</span>
      </div>

      {currentStore ? (
        <div className="hidden lg:flex items-center gap-2 ml-auto mr-4">
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {currentStore.name}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
