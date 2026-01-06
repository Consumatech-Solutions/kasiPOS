'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TransactionsPage() {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const getCustomerName = (customerId: number | undefined) => {
    if (!customers || !customerId) return 'N/A';
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>View a log of all past sales transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <Accordion type="single" collapsible className="w-full">
            {transactions && transactions.length > 0 ? (
              transactions.map(transaction => (
                <AccordionItem value={`item-${transaction.id}`} key={transaction.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4">
                      <div className="text-left">
                        <p className="font-medium">Transaction #{transaction.id}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(transaction.date), 'PPP p')}</p>
                      </div>
                      <div className="text-right">
                         <p className="font-semibold text-lg">R{transaction.total.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Customer: {getCustomerName(transaction.customerId)}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 pl-2">
                      {transaction.items.map(item => (
                        <li key={item.productId} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">{item.productName}</span>
                            <span className="text-muted-foreground ml-2">({item.quantity} x R{item.unitPrice.toFixed(2)})</span>
                          </div>
                          <span className="font-medium">R{item.totalPrice.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))
            ) : (
              <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                No transactions found.
              </div>
            )}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
