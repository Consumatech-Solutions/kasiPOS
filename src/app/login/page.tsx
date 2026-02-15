
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { authApi } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/components/settings-provider';
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

const loginSchema = z.object({
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function LoginPage() {
    const { login } = useSettings();
    const router = useRouter();

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            phone: '',
            password: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof loginSchema>) => {
        try {
            const response = await authApi.login(values.phone, values.password);
            
            if (response.data && response.data.accessToken) {
                feedback.success('Login successful', 'Welcome back!');
                // Pass user and token to settings provider
                await login({ 
                    ...response.data.user, 
                    accessToken: response.data.accessToken 
                });
                // Router push is handled inside login() or settings provider effect, but we can do it here too if needed
                // router.push('/'); 
            }
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string; response?: { status?: number; data?: { message?: string } } };
            if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('Backend not reachable. Ensure backend is running on http://localhost:3001');
                }
                feedback.error('Connection error', 'Cannot reach server.', 'Ensure the backend is running and try again.', { code: ERROR_CODES.LOGIN });
                return;
            }

            const status = err?.response?.status;
            const message = err?.response?.data?.message || (status === 401 ? 'Invalid phone number or password.' : 'Login failed. Please try again.');
            feedback.error(
                'Login failed',
                message,
                status === 401 ? 'Check your phone number and password.' : 'Try again or request access if you don\'t have an account.',
                { code: ERROR_CODES.LOGIN }
            );
        }
    };


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Welcome Back!</CardTitle>
          <CardDescription className="text-sm">Enter your details to sign in to your store</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mobile Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., 0812345678" className="touch-target" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input type="password" className="touch-target" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full min-h-[44px] touch-target">Sign In</Button>
                </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
                First time here? <Button variant="link" className="p-0 min-h-[44px] touch-target" asChild><Link href="/request-access">Request Access</Link></Button>
                {' · '}
                Store admin? <Button variant="link" className="p-0 min-h-[44px] touch-target" asChild><Link href="/set-password-store-admin">Set your password</Link></Button>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
