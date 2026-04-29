"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/pagination";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  const { page, totalPages, total, limit } = meta;

  // Always show pagination if there are items
  if (total === 0) {
    return null;
  }

  // Compute pages to show (max 5 visible)
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    // If only one page, still show it
    if (totalPages <= 1) {
      pages.push(1);
      return pages;
    }

    if (totalPages <= maxVisible) {
      // Display all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        // Start: [1] [2] [3] [4] ... [last]
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        // End: [1] ... [n-3] [n-2] [n-1] [n]
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        // Middle: [1] ... [p-1] [p] [p+1] ... [last]
        pages.push(1);
        pages.push("ellipsis");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className={cn("flex items-center justify-between px-2", className)}>
      <div className="flex-1 text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {total} results
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Go to previous page</span>
        </Button>

        {pageNumbers.map((p, index) => {
          if (p === "ellipsis") {
            return (
              <Button
                key={`ellipsis-${index}`}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More pages</span>
              </Button>
            );
          }

          const pageNum = p as number;
          return (
            <Button
              key={pageNum}
              variant={pageNum === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="h-8 w-8 p-0"
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Go to next page</span>
        </Button>
      </div>
    </div>
  );
}
