'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Customer, Transaction } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { useCustomers } from '@/hooks/use-customers';
import { CustomerForm } from '@/components/customers/customer-form';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Star, History, Search, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination } from '@/components/ui/pagination';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function CustomersPage() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { currentStore } = settings;
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Use the API hook
  const { customers, pagination, loading, error, createCustomer, updateCustomer, deleteCustomer, loadPage, isCreating, isUpdating, isDeleting } = useCustomers({
    searchQuery: searchTerm,
  });

  // Get customer transactions (still using IndexedDB for transactions)
  const customerTransactions = useLiveQuery(() => {
    if (selectedCustomer && currentStore) {
      // customerId can be a number (old format) or string (new UUID format)
      // Filter manually to handle both cases
      return db.transactions
        .where('storeId')
        .equals(currentStore.id!)
        .filter(t => {
          // Compare with both possible formats
          const customerId = selectedCustomer.id;
          return t.customerId === customerId || 
                 t.customerId === Number(customerId) || 
                 String(t.customerId) === String(customerId);
        })
        .reverse()
        .toArray();
    }
    return [];
  }, [selectedCustomer, currentStore]);

  // Handlers for Customers
  const openCustomerDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
    } else {
      setEditingCustomer(null);
    }
    setCustomerDialogOpen(true);
  };
  
  const handleCustomerSubmit = async (data: any) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data);
        toast({ title: "Success", description: "Customer updated successfully." });
      } else {
        await createCustomer(data);
        toast({ title: "Success", description: "Customer added successfully." });
      }
      setCustomerDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Failed to save customer:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save customer.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  const handleDeleteCustomer = async (id: string) => {
    setDeletingCustomerId(id);
    try {
      await deleteCustomer(id);
      toast({ title: "Success", description: "Customer deleted successfully." });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete customer.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const openHistoryDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setHistoryDialogOpen(true);
  };

  const handlePageChange = (page: number) => {
    loadPage(page);
  };

  if (loading && customers.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading customers...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-red-600">Error: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Customers</CardTitle>
          <CardDescription className="text-sm">Manage your customer database and loyalty program.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by name or contact..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => openCustomerDialog()} className="w-full sm:w-auto min-h-[44px] touch-target">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </div>

          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Loyalty Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers && customers.length > 0 ? (
                  customers.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.contact || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />
                          {customer.loyaltyPoints.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button variant="ghost" size="icon" className="touch-target" onClick={() => openHistoryDialog(customer)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="touch-target" onClick={() => openCustomerDialog(customer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="touch-target">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-lg sm:text-xl">Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  This action cannot be undone. This will permanently delete the customer and their data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="min-h-[44px] touch-target w-full sm:w-auto" disabled={deletingCustomerId === customer.id || isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="min-h-[44px] touch-target w-full sm:w-auto" onClick={() => handleDeleteCustomer(customer.id)} disabled={deletingCustomerId === customer.id || isDeleting}>
                                  {(deletingCustomerId === customer.id || isDeleting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {deletingCustomerId === customer.id || isDeleting ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Dialog (Add/Edit) */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingCustomer ? 'Edit the customer information below.' : 'Enter the new customer information.'}
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            customer={editingCustomer || undefined}
            onSubmit={handleCustomerSubmit}
            onCancel={() => {
              setCustomerDialogOpen(false);
              setEditingCustomer(null);
            }}
            isLoading={isCreating || isUpdating}
          />
        </DialogContent>
      </Dialog>
    
      {/* Purchase History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Purchase History for {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerTransactions?.map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell>#{transaction.id}</TableCell>
                    <TableCell>{format(transaction.date, 'PPP')}</TableCell>
                    <TableCell>{transaction.items.length}</TableCell>
                    <TableCell className="text-right">R{transaction.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(!customerTransactions || customerTransactions.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No purchase history for this customer.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
