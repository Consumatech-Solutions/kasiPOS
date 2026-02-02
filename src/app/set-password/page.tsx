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
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
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
    // Use get() directly to avoid Next.js 15 searchParams key access warnings
    const phone = searchParams ? searchParams.get('phone') : null;
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
            feedback.error('Set password failed', 'No phone number was provided.', 'Go back to Request Access and enter your mobile number.', { code: ERROR_CODES.SET_PASSWORD });
            router.push('/request-access');
            return;
        }

        const tempToken = typeof window !== 'undefined' ? localStorage.getItem('kasi-pos-temp-token') : null;
        if (!tempToken) {
            feedback.error('Session expired', 'Your verification session has expired.', 'Request a new code from Request Access and try again.', { code: ERROR_CODES.SET_PASSWORD });
            router.push('/request-access');
            return;
        }

        try {
            const response = await authApi.setPassword(values.password, tempToken);
            
            if (response.data && response.data.accessToken) {
                feedback.success('Password set', 'Your password has been set. You can now sign in.');
                if (typeof window !== 'undefined') localStorage.removeItem('kasi-pos-temp-token');
                await login({
                    ...response.data.user,
                    accessToken: response.data.accessToken,
                });
            }
        } catch (error: unknown) {
            feedback.fromError(
                error,
                'Set password failed',
                'Ensure your password meets the requirements and try again, or request a new code.',
                ERROR_CODES.SET_PASSWORD
            );
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
