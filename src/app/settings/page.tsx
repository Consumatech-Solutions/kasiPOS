'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/db';
import type { User } from '@/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Languages, Info, PlusCircle, Edit, Trash2, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/components/settings-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type Feature = 'campaigns' | 'marketplace' | 'boph';

const userManagementSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

export default function SettingsPage() {
  const { settings, setSetting } = useSettings();
  const { currentUser, currentStore } = settings;
  const { toast } = useToast();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  
  // State for user management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const users = useLiveQuery(() => {
    if (!currentStore) return [];
    return db.users.where('storeId').equals(currentStore.id!).toArray();
  }, [currentStore?.id]);

  const userForm = useForm<z.infer<typeof userManagementSchema>>({
    resolver: zodResolver(userManagementSchema),
    defaultValues: { name: '', phone: '' },
  });

  const handleToggle = (feature: Feature, checked: boolean) => {
    if (checked) {
      setSelectedFeature(feature);
      setModalOpen(true);
    } else {
      setSetting(feature, false);
    }
  };
  
  const handleConfirm = () => {
    if (selectedFeature) {
      setSetting(selectedFeature, true);
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
      case 'campaigns': return { title: 'Opt-In to Campaigns', description: "Campaigns allow you to create and manage discount vouchers for your customers. By opting in, you'll be able to create percentage-based or fixed-amount discounts to drive sales." };
      case 'marketplace': return { title: 'Opt-In to Marketplace', description: "The Marketplace feature allows you to place orders from popular third-party online stores on behalf of your customers, earning a service fee for each order." };
      case 'boph': return { title: 'Opt-In to BOPH', description: "BOPH (Buy Online, Pickup Here) lets your store act as a pickup point for online orders. You'll manage incoming parcels and hand them off to customers, earning a fee for the service." };
      default: return { title: '', description: '' };
    }
  }

  const openUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      userForm.reset({ name: user.name, phone: user.phone });
    } else {
      setEditingUser(null);
      userForm.reset({ name: '', phone: '' });
    }
    setUserDialogOpen(true);
  };

  const handleUserSubmit = async (values: z.infer<typeof userManagementSchema>) => {
    if (!currentStore) {
        toast({ variant: "destructive", title: "Error", description: "No store context found." });
        return;
    }
    try {
      if (editingUser) {
        // Update existing user
        await db.users.update(editingUser.id!, { name: values.name, phone: values.phone });
        toast({ title: "Success", description: "User updated successfully." });
      } else {
        // Add new staff user
        const existingUser = await db.users.where('phone').equals(values.phone).first();
        if (existingUser) {
          toast({ variant: "destructive", title: "Error", description: "A user with this mobile number already exists." });
          return;
        }
        const newUser: Omit<User, 'id'> = { 
            name: values.name, 
            phone: values.phone, 
            role: 'staff',
            storeId: currentStore.id!,
        };
        await db.users.add(newUser as User);
        toast({ title: "Success", description: "Staff user added successfully. They will receive an SMS to set up their password." });
      }
      setUserDialogOpen(false);
    } catch (error) {
      console.error("Failed to save user:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save user." });
    }
  };
  
  const deleteUser = async (id: number) => {
    try {
      if (id === currentUser?.id) {
        toast({ variant: "destructive", title: "Error", description: "You cannot delete your own account." });
        return;
      }
      await db.users.delete(id);
      toast({ title: "Success", description: "User deleted successfully." });
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete user." });
    }
  };

  const featureDetails = getFeatureDetails(selectedFeature);

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

              <div className="space-y-2 pt-4">
                  <h3 className="text-lg font-semibold">Feature Management</h3>
                  <p className="text-sm text-muted-foreground">Enable or disable optional features.</p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                  <Label htmlFor="campaigns-toggle" className="font-semibold">Voucher Campaigns</Label>
                  <p className="text-sm text-muted-foreground">Enable to create and manage discount vouchers.</p>
                  </div>
                  <Switch
                  id="campaigns-toggle"
                  checked={settings.campaigns}
                  onCheckedChange={(checked) => handleToggle('campaigns', checked)}
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
                  />
              </div>
          </CardContent>
        </Card>

        {currentUser?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users /> User Management</CardTitle>
              <CardDescription>Add, edit, or remove staff members from your store.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={() => openUserDialog()}>
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
                  {users?.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{user.role}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openUserDialog(user)}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={user.id === currentUser?.id}>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={modalOpen} onOpenChange={setModalOpen}>
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
    </>
  );
}
