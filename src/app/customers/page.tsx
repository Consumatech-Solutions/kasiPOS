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
import { PlusCircle, Edit, Trash2, Star, History, Search } from 'lucide-react';
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

  // Use the new hook
  const { customers, pagination, loading, error, createCustomer, updateCustomer, deleteCustomer, loadPage } = useCustomers({
    searchQuery: searchTerm,
  });

  // Get customer transactions
  const customerTransactions = useLiveQuery(() => {
    if (selectedCustomer && currentStore) {
      // customerId peut être un number (ancien format) ou string (nouveau format UUID)
      // On filtre manuellement pour gérer les deux cas
      return db.transactions
        .where('storeId')
        .equals(currentStore.id!)
        .filter(t => {
          // Comparer avec les deux formats possibles
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
        toast({ title: "Succès", description: "Client modifié avec succès." });
      } else {
        await createCustomer(data);
        toast({ title: "Succès", description: "Client ajouté avec succès." });
      }
      setCustomerDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Failed to save customer:", error);
      const errorMessage = error instanceof Error ? error.message : "Échec de l'enregistrement du client.";
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await deleteCustomer(id);
      toast({ title: "Succès", description: "Client supprimé avec succès." });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      const errorMessage = error instanceof Error ? error.message : "Échec de la suppression du client.";
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
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
            <div className="text-center">Chargement des clients...</div>
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
            <div className="text-red-600">Erreur: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Gérez votre base de données clients et programme de fidélité.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Rechercher par nom ou contact..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => openCustomerDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un client
            </Button>
          </div>

          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Points de fidélité</TableHead>
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
                        <Button variant="ghost" size="icon" onClick={() => openHistoryDialog(customer)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openCustomerDialog(customer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Cela supprimera définitivement le client et ses données.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCustomer(customer.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                      Aucun client trouvé.
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Modifier le client' : 'Ajouter un client'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Modifiez les informations du client ci-dessous.' : 'Entrez les informations du nouveau client.'}
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            customer={editingCustomer || undefined}
            onSubmit={handleCustomerSubmit}
            onCancel={() => {
              setCustomerDialogOpen(false);
              setEditingCustomer(null);
            }}
          />
        </DialogContent>
      </Dialog>
    
      {/* Purchase History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historique des achats pour {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Articles</TableHead>
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
              <p className="text-center text-muted-foreground py-8">Aucun historique d'achat pour ce client.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
