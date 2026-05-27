"use client";

import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TransactionsToolbar } from "@/components/transactions/transactions-toolbar";
import { TransactionsList } from "@/components/transactions/transactions-list";
import { ClearCreditDialog } from "@/components/transactions/clear-credit-dialog";
import { useTransactionsPage } from "@/hooks/use-transactions-page";

function TransactionsPageContent() {
  const {
    loading,
    error,
    listFilter,
    setListFilter,
    pendingCreditCount,
    selectedDate,
    setSelectedDate,
    searchTerm,
    setSearchTerm,
    clearFilters,
    filteredTransactions,
    highlightId,
    clearTarget,
    setClearTarget,
    getCustomerName,
    handleConfirmClearCredit,
    clearCreditIsPending,
  } = useTransactionsPage();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">
          Transaction History
        </CardTitle>
        <CardDescription className="text-sm">
          View sales, pending credit, and mark credit as paid when customers
          settle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TransactionsToolbar
          listFilter={listFilter}
          pendingCreditCount={pendingCreditCount}
          selectedDate={selectedDate}
          searchTerm={searchTerm}
          onListFilterChange={setListFilter}
          onSelectedDateChange={setSelectedDate}
          onSearchTermChange={setSearchTerm}
          onClearFilters={clearFilters}
        />

        <ScrollArea className="h-[calc(100vh-18rem)]">
          {loading ? (
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              Loading transactions...
            </div>
          ) : error ? (
            <div className="text-center h-24 flex items-center justify-center text-destructive">
              {error}
            </div>
          ) : (
            <TransactionsList
              transactions={filteredTransactions}
              listFilter={listFilter}
              highlightId={highlightId}
              getCustomerName={getCustomerName}
              onMarkCreditPaid={setClearTarget}
            />
          )}
        </ScrollArea>
      </CardContent>

      <ClearCreditDialog
        clearTarget={clearTarget}
        customerName={getCustomerName(clearTarget?.customerId)}
        isPending={clearCreditIsPending}
        onOpenChange={(open) => !open && setClearTarget(null)}
        onConfirm={handleConfirmClearCredit}
      />
    </Card>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
              Loading transactions...
            </div>
          </CardContent>
        </Card>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
