'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { db } from '@/lib/db';

const setPasswordSchema = z.object({
    password: z.string().min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ['confirmPassword'],
});

export default function SetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const phone = searchParams.get('phone');
    const { toast } = useToast();
    const { login } = useSettings();

    const form = useForm<z.infer<typeof setPasswordSchema>>({
        resolver: zodResolver(setPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof setPasswordSchema>) => {
        if (!phone) {
            toast({ variant: 'destructive', title: 'Error', description: 'No phone number provided.' });
            router.push('/request-access');
            return;
        }

        const user = await db.users.where('phone').equals(phone).first();
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
            router.push('/request-access');
            return;
        }

        try {
            await db.users.update(user.id!, { password: values.password });
            toast({
                title: 'Password Set!',
                description: 'Your password has been successfully created.',
            });
            
            const updatedUser = { ...user, password: values.password };
            login(updatedUser);

        } catch (error) {
            console.error('Failed to set password', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to set password.',
            });
        }
    };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>Create a secure password to protect your account. This will be used for future sign-ins.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full">Set Password & Continue</Button>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}
