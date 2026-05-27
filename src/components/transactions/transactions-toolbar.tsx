"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type ListFilter = "all" | "pending-credit";

export type TransactionsToolbarProps = {
  readonly listFilter: ListFilter;
  readonly pendingCreditCount: number;
  readonly selectedDate: Date | undefined;
  readonly searchTerm: string;
  readonly onListFilterChange: (filter: ListFilter) => void;
  readonly onSelectedDateChange: (date: Date | undefined) => void;
  readonly onSearchTermChange: (term: string) => void;
  readonly onClearFilters: () => void;
};

export function TransactionsToolbar({
  listFilter,
  pendingCreditCount,
  selectedDate,
  searchTerm,
  onListFilterChange,
  onSelectedDateChange,
  onSearchTermChange,
  onClearFilters,
}: TransactionsToolbarProps) {
  const hasActiveFilters =
    Boolean(selectedDate) || Boolean(searchTerm) || listFilter !== "all";

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={listFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onListFilterChange("all")}
        >
          All transactions
        </Button>
        <Button
          variant={listFilter === "pending-credit" ? "default" : "outline"}
          size="sm"
          onClick={() => onListFilterChange("pending-credit")}
        >
          Pending credit
          {pendingCreditCount > 0 ? (
            <Badge variant="secondary" className="ml-2">
              {pendingCreditCount}
            </Badge>
          ) : null}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? (
                format(selectedDate, "PPP")
              ) : (
                <span>Filter by date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectedDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by Order # or Customer"
            className="pl-10"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>

        {hasActiveFilters ? (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="min-h-[44px] touch-target w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" /> Clear Filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
