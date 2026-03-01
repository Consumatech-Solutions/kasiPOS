'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User } from '@/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Languages, Info, PlusCircle, Edit, Trash2, Users, Key, RefreshCw, Wifi, WifiOff, Receipt } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/components/settings-provider';
import { usersApi } from '@/lib/api';
import { storesApi } from '@/lib/api/stores';
import { saveStorePermanently } from '@/lib/store-persistence';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { feedback } from '@/lib/feedback';
import { Badge } from '@/components/ui/badge';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useEnsureStore } from '@/hooks/use-ensure-store';
import { mutationQueue } from '@/lib/mutation-queue';

type Feature = 'campaigns' | 'marketplace' | 'boph' | 'buyStock';

const userManagementSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().min(1, { message: "Email is required." }).email({ message: "Please enter a valid email address." }),
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

/** Normalize phone to digits only; backend often expects digits only. */
function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

const passwordSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Please confirm your password." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function SettingsPage() {
  const { settings, setSetting } = useSettings();
  const { currentUser, currentStore: settingsStore } = settings;
  console.log('currentUser', currentUser);
  console.log('settingsStore', settingsStore);
  const isAdmin = currentUser != null && String(currentUser.role ?? '').toLowerCase() === 'admin' || settingsStore?.ownerId === currentUser?.id || currentUser?.role === 'store_admin';
  const { ensureStore } = useEnsureStore();
  const { isOnline } = useNetworkStatus();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingModules, setIsUpdatingModules] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  
  // State for user management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [duplicatePhonePopupOpen, setDuplicatePhonePopupOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForPassword, setUserForPassword] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const TABLE_LIMIT = 5;

  /** Detect if the error indicates the phone number is already registered (duplicate). */
  const isDuplicatePhoneError = (error: unknown): boolean => {
    const err = error as { response?: { status?: number; data?: { message?: string; error?: string } | string }; message?: string };
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = (
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'object' && data?.error) ||
      (typeof data === 'string' ? data : '') ||
      ''
    ).toLowerCase();
    if (status === 409) return true;
    if (status === 400 && (msg.includes('phone') || msg.includes('duplicate') || msg.includes('already') || msg.includes('exist'))) return true;
    // 500 on create user: backend often returns 500 for duplicate phone (e.g. unique constraint)
    if (status === 500) return true;
    return false;
  };

  const userManagementStoreId = settingsStore?.id ?? currentUser?.storeId ?? null;

  // Ensure we have a store when admin/store_admin opens Settings (so User Management can show and add staff)
  useEffect(() => {
    const needStore = (isAdmin || currentUser?.role === 'store_admin') && !userManagementStoreId;
    if (needStore) {
      ensureStore().catch(() => {});
    }
  }, [isAdmin, currentUser?.role, userManagementStoreId]);

  const fetchUsers = async () => {
    if (!userManagementStoreId) {
      setUsers([]);
      setTotalPages(0);
      return;
    }
    try {
        const response = await usersApi.findAll(userManagementStoreId, page, TABLE_LIMIT);
        const body = response.data;
        const list = Array.isArray(body?.data) ? body.data : [];
        const totalPages = typeof body?.meta?.totalPages === 'number' ? body.meta.totalPages : 0;
        setUsers(list as User[]);
        setTotalPages(totalPages);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
        setTotalPages(0);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userManagementStoreId, page]);

  const userForm = useForm<z.infer<typeof userManagementSchema>>({
    resolver: zodResolver(userManagementSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const updateStoreModule = async (feature: Feature, enabled: boolean) => {
    const store = settings.currentStore;
    if (!store?.id) {
      setSetting(feature, enabled);
      return;
    }
    setIsUpdatingModules(true);
    try {
      const nextModules = { ...store.enabledModules, [feature]: enabled };
      const response = await storesApi.update(store.id, { enabledModules: nextModules });
      if (response?.data) {
        setSetting('currentStore', response.data);
        await saveStorePermanently(response.data, setSetting);
      } else {
        setSetting(feature, enabled);
      }
    } catch (err: any) {
      console.error('Failed to update store modules:', err);
      feedback.error('Update failed', err?.message ?? 'Could not update feature. Try again.');
      setSetting(feature, !enabled); // revert local state
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const updateShowVatInCheckout = async (checked: boolean) => {
    const store = settings.currentStore;
    if (!store?.id) {
      setSetting('showVatInCheckout', checked);
      return;
    }
    setIsUpdatingModules(true);
    try {
      const nextModules = { ...store.enabledModules, showVatInCheckout: checked };
      const response = await storesApi.update(store.id, { enabledModules: nextModules });
      if (response?.data) {
        setSetting('currentStore', response.data);
        await saveStorePermanently(response.data, setSetting);
      } else {
        setSetting('showVatInCheckout', checked);
      }
    } catch (err: any) {
      console.error('Failed to update showVatInCheckout:', err);
      feedback.error('Update failed', err?.message ?? 'Could not update setting. Try again.');
      setSetting('showVatInCheckout', !checked);
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const handleToggle = (feature: Feature, checked: boolean) => {
    if (checked) {
      setUserDialogOpen(false);
      setSelectedFeature(feature);
      setModalOpen(true);
    } else {
      updateStoreModule(feature, false);
    }
  };

  const handleConfirm = async () => {
    if (selectedFeature) {
      await updateStoreModule(selectedFeature, true);
    }
    setModalOpen(false);
    setSelectedFeature(null);
  };
  
  const handleCancel = () => {
    setModalOpen(false);
    setSelectedFeature(null);
  }

  const getFeatureDetails = (feature: Feature | null) => {
    switch(feature) {
      case 'campaigns': return { title: 'Opt-In to Campaigns', description: "Campaigns allow you to create and participate in loyalty and reward programmes." };
      case 'marketplace': return { title: 'Opt-In to Marketplace', description: "The Marketplace feature allows you to place orders from popular third-party online stores on behalf of your customers, earning a service fee for each order." };
      case 'boph': return { title: 'Opt-In to BOPH', description: "BOPH (Buy Online, Pickup Here) lets your store act as a pickup point for online orders. You'll manage incoming parcels and hand them off to customers, earning a fee for the service." };
      case 'buyStock': return { title: 'Opt-In to Buy Stock', description: "Buy Stock lets you order inventory and manage purchase orders for your store." };
      default: return { title: '', description: '' };
    }
  }

  const openUserDialog = (user?: User) => {
    setModalOpen(false);
    setSelectedFeature(null);
    if (user) {
      setEditingUser(user);
      userForm.reset({ name: user.name, email: user.email ?? '', phone: user.phone ?? '' });
    } else {
      setEditingUser(null);
      userForm.reset({ name: '', email: '', phone: '' });
    }
    setUserDialogOpen(true);
  };

  const handleUserSubmit = async (values: z.infer<typeof userManagementSchema>) => {
    const storeId = userManagementStoreId ?? (await ensureStore())?.id ?? currentUser?.storeId;
    if (!storeId) {
      feedback.error('No store', 'Cannot add staff without a store. Open the app and ensure a store is loaded.', undefined, { code: 'USER' });
      return;
    }
    try {
      if (editingUser) {
        // Update existing user
        const updateData = { name: values.name, email: values.email.trim(), phone: values.phone };
        if (isOnline) {
          await usersApi.update(editingUser.id!, updateData);
          feedback.success('User updated', 'User updated successfully.');
        } else {
          mutationQueue.add({
            mutationKey: ['users', 'update'],
            mutationFn: () => usersApi.update(editingUser.id!, updateData),
            variables: { id: editingUser.id, data: updateData },
          });
          feedback.success('Queued', 'User update queued. Will sync when online.');
        }
      } else {
        // Add new staff user for this store only (POST /users)
        const phone = normalizePhone(values.phone);
        if (phone.length < 10) {
          feedback.error('Invalid number', 'Please enter at least 10 digits.', undefined, { code: 'USER' });
          return;
        }
        const createData = {
          name: values.name.trim(),
          email: values.email.trim(),
          phone,
          role: 'staff',
          storeId,
        };
        if (isOnline) {
          await usersApi.create(createData);
          feedback.success('Staff user added', 'They will receive an SMS to set up their password. They are assigned to this store only.');
        } else {
          mutationQueue.add({
            mutationKey: ['users', 'create'],
            mutationFn: () => usersApi.create(createData),
            variables: createData,
          });
          feedback.success('Queued', 'Staff queued. Will sync when online.');
        }
      }
      setUserDialogOpen(false);
      fetchUsers(); // Refresh list
    } catch (error: any) {
      console.error("Failed to save user:", error);
      if (!editingUser && isDuplicatePhoneError(error)) {
        setUserDialogOpen(false);
        setDuplicatePhonePopupOpen(true);
        return;
      }
      feedback.fromError(error, 'Failed to save user', 'Check the details and try again, or try again later.');
    }
  };

  const closeDuplicatePhonePopup = () => {
    setDuplicatePhonePopupOpen(false);
    // Reopen Add Staff form after popup closes so user can try again without clicking the button
    setTimeout(() => setUserDialogOpen(true), 0);
  };

  const deleteUser = async (id: string) => { // ID is uuid string now
    try {
      if (id === currentUser?.id) {
        feedback.error('Cannot delete', 'You cannot delete your own account.', 'Ask another admin to remove you.');
        return;
      }
      if (isOnline) {
        await usersApi.remove(id);
        feedback.success('User deleted', 'User deleted successfully.');
      } else {
        mutationQueue.add({
          mutationKey: ['users', 'delete'],
          mutationFn: () => usersApi.remove(id),
          variables: { id },
        });
        feedback.success('Queued', 'User deletion queued. Will sync when online.');
      }
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error("Failed to delete user:", error);
      feedback.fromError(error, 'Failed to delete user', 'Check your connection and try again.');
    }
  };

  const openPasswordDialog = (user: User) => {
    setUserForPassword(user);
    passwordForm.reset({ password: '', confirmPassword: '' });
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    if (!userForPassword?.id) return;
    
    try {
      await usersApi.update(userForPassword.id, { password: values.password });
      feedback.success('Password updated', 'Password updated successfully.');
      setPasswordDialogOpen(false);
      setUserForPassword(null);
      passwordForm.reset();
    } catch (error: any) {
      console.error("Failed to update password:", error);
      feedback.fromError(error, 'Failed to update password', 'Ensure the password meets requirements and try again.');
    }
  };

  const featureDetails = getFeatureDetails(selectedFeature);

  const handleUpdateApp = async () => {
    if (!isOnline) {
      feedback.error('Offline', 'Please connect to the internet to update the app.', 'Connect to Wi‑Fi or mobile data and try again.');
      return;
    }

    setIsUpdating(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear service worker cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      }

      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Clear Dexie query cache
      try {
        const { getDb } = await import('@/lib/db');
        await getDb().keyVal.delete('REACT_QUERY_OFFLINE_CACHE');
      } catch (e) {
        console.warn('Failed to clear query cache:', e);
      }

      feedback.success('Cache cleared', 'Reloading the app with the latest version...');

      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to update app:', error);
      feedback.fromError(error, 'Failed to update the app', 'Check your connection and try again.');
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage your application preferences and features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="theme-toggle" className="font-semibold flex items-center gap-2">
                  {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  Theme
                </Label>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
              </div>
              <Switch
                id="theme-toggle"
                checked={settings.theme === 'dark'}
                onCheckedChange={(checked) => setSetting('theme', checked ? 'dark' : 'light')}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="language-select" className="font-semibold flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  Language
                </Label>
                <p className="text-sm text-muted-foreground">Choose your preferred language (coming soon).</p>
              </div>
               <Select defaultValue="en" disabled>
                  <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="sw">Swahili</SelectItem>
                      <SelectItem value="zu">Zulu</SelectItem>
                      <SelectItem value="so">Somali</SelectItem>
                      <SelectItem value="am">Amharic</SelectItem>
                  </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="update-app" className="font-semibold flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Update App
                </Label>
                <p className="text-sm text-muted-foreground">
                  Clear cache and reload the app to get the latest version.
                </p>
              </div>
              <Button
                id="update-app"
                onClick={handleUpdateApp}
                disabled={!isOnline || isUpdating}
                variant="outline"
                className="min-h-[44px] touch-target"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    {isOnline ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Update
                      </>
                    ) : (
                      <>
                        <WifiOff className="mr-2 h-4 w-4" />
                        Offline
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>

              <div className="space-y-2 pt-4">
                  <h3 className="text-lg font-semibold">Feature Management</h3>
                  <p className="text-sm text-muted-foreground">Enable or disable optional features.</p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                  <Label htmlFor="campaigns-toggle" className="font-semibold">Campaigns</Label>
                  <p className="text-sm text-muted-foreground">Enable to create and participate in loyalty and reward programmes.</p>
                  </div>
                  <Switch
                  id="campaigns-toggle"
                  checked={settings.campaigns}
                  onCheckedChange={(checked) => handleToggle('campaigns', checked)}
                  disabled={isUpdatingModules}
                  />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                  <Label htmlFor="marketplace-toggle" className="font-semibold">Marketplace</Label>
                  <p className="text-sm text-muted-foreground">Enable ordering from third-party stores.</p>
                  </div>
                  <Switch
                  id="marketplace-toggle"
                  checked={settings.marketplace}
                  onCheckedChange={(checked) => handleToggle('marketplace', checked)}
                  disabled={isUpdatingModules}
                  />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                  <Label htmlFor="boph-toggle" className="font-semibold">Buy Online, Pickup Here (BOPH)</Label>
                  <p className="text-sm text-muted-foreground">Enable parcel pickup point services.</p>
                  </div>
                  <Switch
                  id="boph-toggle"
                  checked={settings.boph}
                  onCheckedChange={(checked) => handleToggle('boph', checked)}
                  disabled={isUpdatingModules}
                  />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                  <Label htmlFor="buy-stock-toggle" className="font-semibold">Buy Stock</Label>
                  <p className="text-sm text-muted-foreground">Enable ordering inventory and managing purchase orders.</p>
                  </div>
                  <Switch
                  id="buy-stock-toggle"
                  checked={settings.buyStock}
                  onCheckedChange={(checked) => handleToggle('buyStock', checked)}
                  disabled={isUpdatingModules}
                  />
              </div>

              {(isAdmin || currentUser != null) && (
                <>
                  <div id="checkout-display-admin" className="space-y-2 pt-4 scroll-mt-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><Receipt className="w-5 h-5" /> Checkout display {isAdmin ? '(Admin)' : ''}</h3>
                    <p className="text-sm text-muted-foreground">When ON, VAT is added to the total (Total = Subtotal + VAT). When OFF, VAT is included in the total (no addition).</p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="show-vat-toggle" className="font-semibold">Show VAT in checkout summary</Label>
                      <p className="text-sm text-muted-foreground">When ON, VAT is added on top (Total = Subtotal + VAT). When OFF, VAT is included in prices and the VAT line is hidden.</p>
                    </div>
                    <Switch
                      id="show-vat-toggle"
                      checked={settings.showVatInCheckout !== false}
                      onCheckedChange={(checked) => updateShowVatInCheckout(checked)}
                      disabled={isUpdatingModules}
                    />
                  </div>
                </>
              )}
          </CardContent>
        </Card>

        {(isAdmin || currentUser?.role === 'store_admin') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users /> User Management</CardTitle>
              <CardDescription>
                {userManagementStoreId && settingsStore?.name
                  ? `Staff for this store only: ${settingsStore.name}. Add, edit, or remove staff assigned to this store.`
                  : userManagementStoreId
                    ? 'Staff for this store only. Add, edit, or remove staff assigned to this store.'
                    : 'Load or select a store to manage its staff. Only staff assigned to the current store are shown.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button
                  type="button"
                  disabled={!userManagementStoreId}
                  onClick={(e) => { e.stopPropagation(); openUserDialog(); }}
                  title={!userManagementStoreId ? 'Select or load a store first' : 'Add staff to this store'}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Staff
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No staff members found. Add one above!
                          </TableCell>
                      </TableRow>
                  )}
                  {users?.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell><Badge variant={user.role === 'admin' || user.storeId === settingsStore?.id  || user.role === 'store_admin' ? 'default' : 'secondary'} className="capitalize">{user.role}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openUserDialog(user)} title="Edit user">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(user)} title="Set password">
                            <Key className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={user.id === currentUser?.id} title="Delete user">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone. This will permanently delete the user account.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(user.id!)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={modalOpen && selectedFeature != null} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              {featureDetails.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {featureDetails.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Opt-In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="staff@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      {userForPassword && (
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Password for {userForPassword.name}</DialogTitle>
              <DialogDescription>
                Set a new password for this user. They will be able to use this password to log in.
              </DialogDescription>
            </DialogHeader>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="Enter new password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="Confirm new password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Set Password</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Duplicate phone number popup */}
      <AlertDialog open={duplicatePhonePopupOpen} onOpenChange={setDuplicatePhonePopupOpen}>
        <AlertDialogContent className="z-[100]" aria-describedby="duplicate-phone-description">
          <AlertDialogHeader>
            <AlertDialogTitle>Number already registered</AlertDialogTitle>
            <AlertDialogDescription id="duplicate-phone-description">
              This phone number is already registered for a staff member. Please use a different number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeDuplicatePhonePopup}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
