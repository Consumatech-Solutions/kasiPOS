"use client";

import { format } from "date-fns";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import {
  getCreditDueAt,
  getTransactionStatus,
  isPendingCreditTransaction,
} from "@/lib/credit-transactions";
import {
  formatCreditDueLabel,
  formatTransactionIdShort,
  parseTransactionDate,
  transactionIdString,
} from "@/lib/transaction-utils";

function statusBadgeVariant(
  status: ReturnType<typeof getTransactionStatus>
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending") return "destructive";
  if (status === "failed") return "outline";
  return "secondary";
}

export type TransactionAccordionItemProps = {
  readonly transaction: Transaction;
  readonly index: number;
  readonly highlightId: string | null;
  readonly customerName: string;
  readonly onMarkCreditPaid: (transaction: Transaction) => void;
};

export function TransactionAccordionItem({
  transaction,
  index,
  highlightId,
  customerName,
  onMarkCreditPaid,
}: TransactionAccordionItemProps) {
  const txId = transactionIdString(transaction.id);
  const transactionDate = parseTransactionDate(transaction);
  const status = getTransactionStatus(transaction);
  const dueLabel = formatCreditDueLabel(getCreditDueAt(transaction));
  const isHighlighted =
    highlightId != null &&
    highlightId !== "" &&
    txId !== "" &&
    txId === highlightId;
  const canClear = isPendingCreditTransaction(transaction);

  return (
    <AccordionItem
      value={`item-${txId || index}`}
      className={cn(isHighlighted && "rounded-md ring-2 ring-primary/40")}
    >
      <AccordionTrigger>
        <div className="flex justify-between w-full pr-4 gap-2">
          <div className="text-left min-w-0">
            <p className="font-medium">
              Transaction #{formatTransactionIdShort(transaction.id)}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(transactionDate, "PPP p")}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
              {transaction.paymentMethod === "Credit" && dueLabel ? (
                <Badge variant="outline" className="text-xs">
                  Due {dueLabel}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-semibold text-lg">
              R{Number(transaction.total).toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">{customerName}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <ul className="space-y-2 pl-2">
          {transaction.items?.map((item) => (
            <li
              key={`${txId || index}-${item.productId}`}
              className="flex justify-between items-center text-sm"
            >
              <div>
                <span className="font-medium">{item.productName}</span>
                <span className="text-muted-foreground ml-2">
                  ({item.quantity} x R{Number(item.unitPrice).toFixed(2)})
                </span>
              </div>
              <span className="font-medium">
                R{Number(item.totalPrice).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{transaction.paymentMethod}</Badge>
          {canClear ? (
            <Button
              size="sm"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onMarkCreditPaid(transaction);
              }}
            >
              <Banknote className="h-4 w-4" />
              Mark credit as paid
            </Button>
          ) : null}
        </div>
        {transaction.creditDetails?.note ? (
          <p className="text-xs text-muted-foreground mt-2 pl-2">
            Note: {transaction.creditDetails.note}
          </p>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
