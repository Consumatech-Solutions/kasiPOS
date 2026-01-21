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
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/components/settings-provider';
import { useCustomers } from '@/hooks/use-customers';

export default function TransactionsPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;

  const allTransactions = useLiveQuery(() => {
    if (!currentStore) return [];
    return db.transactions.where('storeId').equals(currentStore.id!).orderBy('date').reverse().toArray()
  }, [currentStore?.id]);

  // Use API hook for customers
  const { customers: allCustomersList } = useCustomers({ initialLimit: 1000 });
  const customers = allCustomersList || [];

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState('');


  const getCustomerName = (customerId: number | string | undefined) => {
    if (!customers || !customerId) return 'N/A';
    return customers.find(c => c.id === String(customerId) || c.id === customerId)?.name || 'Unknown';
  };

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    return allTransactions.filter(transaction => {
      const dateMatch = !selectedDate || (
        transaction.date >= startOfDay(selectedDate) && transaction.date <= endOfDay(selectedDate)
      );

      const searchTermLower = searchTerm.toLowerCase();
      const searchMatch = !searchTerm || (
        String(transaction.id).includes(searchTermLower) ||
        getCustomerName(transaction.customerId).toLowerCase().includes(searchTermLower)
      );

      return dateMatch && searchMatch;
    });

  }, [allTransactions, selectedDate, searchTerm, customers]);


  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm('');
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

            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by Order # or Customer"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {(selectedDate || searchTerm) && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear Filters
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
