'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { Customer, Transaction } from '@/types';
import { feedback } from '@/lib/feedback';
import { useSettings } from '@/components/settings-provider';
import { useCustomers, customerKeys } from '@/hooks/use-customers';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { mutationQueue } from '@/lib/mutation-queue';
import { executeMutation } from '@/lib/mutation-registry';
import { saveCustomersToDexie, updateCustomerInDexie, deleteCustomerFromDexie } from '@/lib/entity-cache';
import { useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/customers';
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
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const { currentStore, currentUser } = settings;
  const { isOnline } = useNetworkStatus();
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
    // Use the API hook. Store admin: backend uses JWT storeId; we pass storeIdForOffline so offline list is scoped to current store.
  const { customers, pagination, loading, error, createCustomer, updateCustomer, deleteCustomer, loadPage, isCreating, isUpdating, isDeleting } = useCustomers({
    searchQuery: searchTerm,
    storeIdForOffline: currentStore?.id ?? undefined,
    initialLimit: 1000,
  });
  const canDeleteCustomer = currentUser?.role === 'store_admin';
  const showStoreColumn = currentUser?.role === 'admin' || (customers.length > 0 && customers.some((c) => c.storeId != null));


  // Dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);



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
        if (isOnline) {
          await updateCustomer(editingCustomer.id, data);
          feedback.success('Customer updated', 'Customer updated successfully.');
        } else {
          // Offline: optimistic update then queue
          const updatedCustomer = { ...editingCustomer, ...data, updatedAt: new Date().toISOString() };
          const customerQueries = queryClient.getQueriesData<{ data: Customer[]; meta: any }>({ queryKey: customerKeys.lists() });
          customerQueries.forEach(([queryKey, qData]) => {
            if (qData?.data) {
              queryClient.setQueryData(queryKey, {
                ...qData,
                data: qData.data.map(c => (c.id === editingCustomer.id ? updatedCustomer : c)),
              });
            }
          });
          await updateCustomerInDexie(editingCustomer.id, data);
          mutationQueue.add({
            mutationKey: ['customers', 'update'],
            mutationFn: () => customersApi.update(editingCustomer.id, data),
            variables: { id: editingCustomer.id, data },
          });
          feedback.success('Queued', 'Customer update queued. Will sync when online.');
        }
      } else {
        if (isOnline) {
          await createCustomer(data);
          const hasContact = data?.contact?.trim();
          feedback.success(
            'Customer created',
            hasContact
              ? 'A welcome SMS has been sent to the number provided.'
              : 'Customer registered.'
          );
        } else {
          // Offline: optimistic update then queue
          const tempId = `temp-${Date.now()}`;
          const optimisticCustomer: Customer = {
            id: tempId,
            name: data.name,
            contact: data.contact,
            loyaltyPoints: data.loyaltyPoints ?? 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const customerQueries = queryClient.getQueriesData<{ data: Customer[]; meta: any }>({ queryKey: customerKeys.lists() });
          customerQueries.forEach(([queryKey, qData]) => {
            if (qData) {
              queryClient.setQueryData(queryKey, {
                ...qData,
                data: [...(qData.data || []), optimisticCustomer],
                meta: { ...qData.meta, total: (qData.meta?.total ?? 0) + 1 },
              });
            } else {
              queryClient.setQueryData(queryKey, {
                data: [optimisticCustomer],
                meta: { total: 1, page: 1, limit: 1000, totalPages: 1 },
              });
            }
          });
          await saveCustomersToDexie([optimisticCustomer]);
          mutationQueue.add({
            mutationKey: ['customers', 'create'],
            mutationFn: () => executeMutation(['customers', 'create'], { ...data, _tempId: tempId }),
            variables: { ...data, _tempId: tempId },
          });
          feedback.success('Queued', 'Customer queued. Will sync when online.');
        }
      }
      setCustomerDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Failed to save customer:", error);
      feedback.fromError(error, 'Failed to save customer', 'Check your connection and try again.');
    }
  };

  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  const handleDeleteCustomer = async (id: string) => {
    if (!canDeleteCustomer) return;
    setDeletingCustomerId(id);
    try {
      if (isOnline) {
        await deleteCustomer(id);
        feedback.success('Customer deleted', 'Customer deleted successfully.');
      } else {
        // Offline: optimistic update then queue
        const customerQueries = queryClient.getQueriesData<{ data: Customer[]; meta: any }>({ queryKey: customerKeys.lists() });
        customerQueries.forEach(([queryKey, qData]) => {
          if (qData?.data) {
            queryClient.setQueryData(queryKey, {
              ...qData,
              data: qData.data.filter(c => c.id !== id),
              meta: { ...qData.meta, total: Math.max(0, (qData.meta?.total ?? 1) - 1) },
            });
          }
        });
        await deleteCustomerFromDexie(id);
        mutationQueue.add({
          mutationKey: ['customers', 'delete'],
          mutationFn: () => customersApi.delete(id),
          variables: { id },
        });
        feedback.success('Queued', 'Customer deletion queued. Will sync when online.');
      }
    } catch (error) {
      console.error("Failed to delete customer:", error);
      feedback.fromError(error, 'Failed to delete customer', 'Try again or check your connection.');
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
    <div className="p-2 sm:p-4 overflow-y-auto h-full">
      <Card>
        <div className="sticky top-0 z-20 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl">Customers</CardTitle>
            <CardDescription className="text-sm">Manage your customer database and loyalty program.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-4">
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
          </CardContent>
        </div>
        <CardContent>
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Loyalty Points</TableHead>
                  {showStoreColumn && (
                    <TableHead className="hidden sm:table-cell">Store</TableHead>
                  )}
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
                      {showStoreColumn && (
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {customer.storeId != null
                            ? customer.storeId === currentStore?.id
                              ? currentStore?.name ?? 'This store'
                              : customer.storeId
                            : '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button variant="ghost" size="icon" className="touch-target" onClick={() => openHistoryDialog(customer)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="touch-target" onClick={() => openCustomerDialog(customer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDeleteCustomer && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="touch-target">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg sm:text-xl">Delete customer?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm">
                                    This cannot be undone. The customer will be permanently removed from your store.
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
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={showStoreColumn ? 5 : 4}
                      className="text-center h-24"
                    >
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
                {customerTransactions?.map((transaction) => {
                  const txDate =
                    transaction.date instanceof Date
                      ? transaction.date
                      : transaction.date
                        ? parseISO(String(transaction.date))
                        : transaction.createdAt
                          ? parseISO(transaction.createdAt)
                          : new Date();
                  return (
                  <TableRow key={transaction.id}>
                    <TableCell>#{transaction.id}</TableCell>
                    <TableCell>{format(txDate, 'PPP')}</TableCell>
                    <TableCell>{transaction.items.length}</TableCell>
                    <TableCell className="text-right">R{transaction.total.toFixed(2)}</TableCell>
                  </TableRow>
                  );
                })}
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
