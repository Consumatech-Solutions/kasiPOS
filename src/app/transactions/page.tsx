'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TransactionsPage() {
  const allTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');


  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    return allTransactions.filter(transaction => {
      const dateMatch = !selectedDate || (
        transaction.date >= startOfDay(selectedDate) && transaction.date <= endOfDay(selectedDate)
      );

      const customerMatch = selectedCustomerId === 'all' || 
                           (transaction.customerId !== undefined && String(transaction.customerId) === selectedCustomerId);

      return dateMatch && customerMatch;
    });

  }, [allTransactions, selectedDate, selectedCustomerId]);

  const getCustomerName = (customerId: number | undefined) => {
    if (!customers || !customerId) return 'N/A';
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSelectedCustomerId('all');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>View and filter your past sales transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Filter by date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Filter by customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {(selectedDate || selectedCustomerId !== 'all') && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
        </div>


        <ScrollArea className="h-[calc(100vh-18rem)]">
          <Accordion type="single" collapsible className="w-full">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => (
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
                     <div className="mt-2 text-right">
                        <Badge variant="secondary">{transaction.paymentMethod}</Badge>
                     </div>
                  </AccordionContent>
                </AccordionItem>
              ))
            ) : (
              <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                No transactions found for the selected filters.
              </div>
            )}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
