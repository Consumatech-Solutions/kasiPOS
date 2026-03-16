'use client';
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
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/components/settings-provider';
import { useCustomers } from '@/hooks/use-customers';
import { useTransactions } from '@/hooks/use-transactions';

export default function TransactionsPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  // Format date for API (YYYY-MM-DD)
  const dateFilter = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;

  // Only send search to backend if it looks like a transaction ID (UUID format or partial)
  // Customer name searches will be handled client-side
  const isTransactionIdSearch = searchTerm && /^[0-9a-f-]{0,36}$/i.test(searchTerm);
  const backendSearch = isTransactionIdSearch ? searchTerm : undefined;

  // Use API hooks. Store admin: backend uses JWT storeId; we pass storeIdForOffline so offline list is scoped to current store.
  const { transactions: allTransactions, loading, error } = useTransactions({
    page: 1,
    limit: 10,
    date: dateFilter,
    search: backendSearch,
    storeIdForOffline: currentStore?.id ?? undefined,
  });

  const { customers: allCustomersList } = useCustomers({ initialLimit: 10 });
  const customers = allCustomersList || [];

  const getCustomerName = (customerId: string | undefined | null) => {
    if (!customers || !customerId) return 'N/A';
    return customers.find(c => c.id === String(customerId))?.name || 'Unknown';
  };

  // Client-side filtering for customer name search
  const filteredTransactions = allTransactions?.filter((transaction: any) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const transactionId = transaction.id?.toLowerCase() || '';
    const customerName = getCustomerName(transaction.customerId).toLowerCase();
    
    // If search looks like transaction ID, backend already filtered it
    // Otherwise, filter by customer name
    const isTransactionIdSearch = /^[0-9a-f-]{0,36}$/i.test(searchTerm);
    if (isTransactionIdSearch) {
      return transactionId.includes(searchLower);
    } else {
      return customerName.includes(searchLower);
    }
  }) || [];

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSearchTerm('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Transaction History</CardTitle>
        <CardDescription className="text-sm">View and filter your past sales transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
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
              <Button variant="ghost" onClick={clearFilters} className="min-h-[44px] touch-target w-full sm:w-auto">
                <X className="mr-2 h-4 w-4" /> Clear Filters
              </Button>
            )}
        </div>


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
            <Accordion type="single" collapsible className="w-full">
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction: any) => {
                  const transactionDate = transaction.createdAt 
                    ? new Date(transaction.createdAt) 
                    : (transaction.date ? new Date(transaction.date) : new Date());
                  
                  return (
                    <AccordionItem value={`item-${transaction.id}`} key={transaction.id}>
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4">
                          <div className="text-left">
                            <p className="font-medium">Transaction #{transaction.id?.substring(0, 8) || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{format(transactionDate, 'PPP p')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">R{Number(transaction.total).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Customer: {getCustomerName(transaction.customerId)}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 pl-2">
                          {transaction.items?.map((item: any) => (
                            <li key={item.productId} className="flex justify-between items-center text-sm">
                              <div>
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-muted-foreground ml-2">({item.quantity} x R{Number(item.unitPrice).toFixed(2)})</span>
                              </div>
                              <span className="font-medium">R{Number(item.totalPrice).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 text-right">
                          <Badge variant="secondary">{transaction.paymentMethod}</Badge>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              ) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                  No transactions found for the selected filters.
                </div>
              )}
            </Accordion>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
