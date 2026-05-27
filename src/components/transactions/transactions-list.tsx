"use client";

import { Accordion } from "@/components/ui/accordion";
import type { Transaction } from "@/types";
import { TransactionAccordionItem } from "./transaction-accordion-item";
import type { ListFilter } from "./transactions-toolbar";

export type TransactionsListProps = {
  readonly transactions: Transaction[];
  readonly listFilter: ListFilter;
  readonly highlightId: string | null;
  readonly getCustomerName: (customerId: string | undefined | null) => string;
  readonly onMarkCreditPaid: (transaction: Transaction) => void;
};

export function TransactionsList({
  transactions,
  listFilter,
  highlightId,
  getCustomerName,
  onMarkCreditPaid,
}: TransactionsListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
        {listFilter === "pending-credit"
          ? "No pending credit sales."
          : "No transactions found for the selected filters."}
      </div>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      defaultValue={highlightId ? `item-${highlightId}` : undefined}
    >
      {transactions.map((transaction, index) => (
        <TransactionAccordionItem
          key={transactionIdKey(transaction, index)}
          transaction={transaction}
          index={index}
          highlightId={highlightId}
          customerName={getCustomerName(transaction.customerId)}
          onMarkCreditPaid={onMarkCreditPaid}
        />
      ))}
    </Accordion>
  );
}

function transactionIdKey(transaction: Transaction, index: number): string {
  const id = transaction.id;
  if (id == null || id === "") return `tx-${index}`;
  return String(id);
}
