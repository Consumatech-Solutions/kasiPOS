'use client';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { db } from '@/lib/db';
import type { Customer, Transaction } from '@/types';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Star, History, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Zod Schema for validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Customer name must be at least 2 characters." }),
  phone: z.string().optional(),
});

export default function CustomersPage() {
  const { toast } = useToast();

  // Dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Live queries
  const allCustomers = useLiveQuery(() => db.customers.toArray(), []);
  
  const customerTransactions = useLiveQuery(() => {
    if (selectedCustomer) {
      return db.transactions.where('customerId').equals(selectedCustomer.id!).reverse().toArray();
    }
    return [];
  }, [selectedCustomer]);

  // Form Hook
  const customerForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  });

  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    return allCustomers.filter(customer => {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = customer.name.toLowerCase().includes(searchTermLower);
      const phoneMatch = customer.phone?.includes(searchTermLower);
      return nameMatch || phoneMatch;
    });
  }, [allCustomers, searchTerm]);

  // Handlers for Customers
  const openCustomerDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      customerForm.reset({
          name: customer.name,
          phone: customer.phone,
      });
    } else {
      setEditingCustomer(null);
      customerForm.reset({ name: '', phone: '' });
    }
    setCustomerDialogOpen(true);
  };
  
  const handleCustomerSubmit = async (values: z.infer<typeof customerSchema>) => {
    try {
      if (editingCustomer) {
        await db.customers.update(editingCustomer.id!, { 
            name: values.name,
            phone: values.phone,
         });
        toast({ title: "Success", description: "Customer updated successfully." });
      } else {
        const newCustomer: Omit<Customer, 'id'> = {
            name: values.name,
            phone: values.phone,
            loyaltyPoints: 0,
        };
        await db.customers.add(newCustomer as Customer);
        toast({ title: "Success", description: "Customer added successfully." });
      }
      setCustomerDialogOpen(false);
    } catch (error) {
      console.error("Failed to save customer:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save customer." });
    }
  };

  const deleteCustomer = async (id: number) => {
    try {
      await db.customers.delete(id);
      toast({ title: "Success", description: "Customer deleted successfully." });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete customer." });
    }
  };

  const openHistoryDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setHistoryDialogOpen(true);
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>Manage your customer database and loyalty program.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                  placeholder="Search by name or phone number..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <Button onClick={() => openCustomerDialog()} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </div>

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
            {filteredCustomers && filteredCustomers.length > 0 ? (
              filteredCustomers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={`https://i.pravatar.cc/40?u=${customer.phone}`} />
                        <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {customer.name}
                    </div>
                  </TableCell>
                  <TableCell>{customer.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />
                      {customer.loyaltyPoints.toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openHistoryDialog(customer)}>
                        <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openCustomerDialog(customer)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the customer and their data.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCustomer(customer.id!)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
      </CardContent>
    </Card>

    {/* Customer Dialog (Add/Edit) */}
    <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            </DialogHeader>
            <Form {...customerForm}>
                <form onSubmit={customerForm.handleSubmit(handleCustomerSubmit)} className="space-y-4">
                    <FormField control={customerForm.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={customerForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mobile Number (Optional)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    {/* Purchase History Dialog */}
    <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase History for {selectedCustomer?.name}</DialogTitle>
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
    </>
  );
}
