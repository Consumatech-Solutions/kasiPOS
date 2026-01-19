'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { db } from '@/lib/db';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

export default function ProfilePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { settings, login, logout } = useSettings();
    const { currentUser } = settings;

    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: currentUser?.name || '',
            phone: currentUser?.phone || '',
        },
    });

    const onSubmit = async (values: z.infer<typeof profileSchema>) => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'No user is logged in.' });
            return;
        }

        const phoneChanged = values.phone !== currentUser.phone;
        const nameChanged = values.name !== currentUser.name;

        if (!phoneChanged && !nameChanged) {
            toast({ title: 'No Changes', description: 'You have not made any changes.' });
            return;
        }

        try {
            if (phoneChanged) {
                const existingUser = await db.users.where('phone').equals(values.phone).first();
                if (existingUser && existingUser.id !== currentUser.id) {
                    toast({ variant: 'destructive', title: 'Error', description: 'This phone number is already in use by another account.' });
                    return;
                }
            }
            
            const updatedUserData = {
                ...currentUser,
                name: values.name,
                phone: values.phone,
            };

            await db.users.update(currentUser.id!, { name: values.name, phone: values.phone });

            if (phoneChanged) {
                toast({
                    title: 'Phone Number Updated',
                    description: 'Please verify your new number. You will be logged out now.',
                });
                // Use a timeout to allow the user to read the toast
                setTimeout(() => {
                    logout();
                }, 2000);
            } else {
                // If only name changed, update context and give feedback
                login(updatedUserData);
                toast({
                    title: 'Profile Updated',
                    description: 'Your name has been successfully updated.',
                });
                router.push('/');
            }

        } catch (error) {
            console.error('Failed to update profile:', error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update your profile.',
            });
        }
    };

    return (
        <div className="p-4">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Button asChild variant="outline" size="icon">
                            <Link href="/">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>Manage your personal information.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile Number</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                              <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}