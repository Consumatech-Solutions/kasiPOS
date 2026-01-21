'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';

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
    // Utiliser get() directement sans accéder aux clés pour éviter les warnings Next.js 15
    const phone = searchParams ? searchParams.get('phone') : null;
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

        const tempToken = localStorage.getItem('kasi-pos-temp-token');
        if (!tempToken) {
             toast({ variant: 'destructive', title: 'Error', description: 'Session expired. Please request a new code.' });
             router.push('/request-access');
             return;
        }

        try {
             // Pass tempToken via headers (handled in api.ts interceptor if we set it, 
             // but here we call setPassword which explicitly accepts it or we rely on interceptor logic.
             // Our API wrapper `setPassword` takes (password, tempToken) and sets header.
             const response = await authApi.setPassword(values.password, tempToken);
             
             if (response.data && response.data.accessToken) {
                toast({ title: "All Set!", description: "Your password has been set." });
                
                // Clear temp token
                localStorage.removeItem('kasi-pos-temp-token');
                
                // Login user
                await login({ 
                    ...response.data.user, 
                    accessToken: response.data.accessToken 
                });
             }

        } catch (error: any) {
            console.error('Set password error:', error);
            const message = error.response?.data?.message || 'Failed to update password.';
             toast({
                variant: 'destructive',
                title: 'Error',
                description: message,
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
