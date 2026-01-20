'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

const requestAccessSchema = z.object({
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

const MOCK_OTP_CODE = '123456';

export default function RequestAccessPage() {
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof requestAccessSchema>>({
        resolver: zodResolver(requestAccessSchema),
        defaultValues: {
            phone: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof requestAccessSchema>) => {
        try {
            await authApi.requestOtp(values.phone);
            
            toast({
                title: 'Code Sent!',
                description: `A verification code has been sent to ${values.phone}.`,
            });
            router.push(`/verify-code?phone=${encodeURIComponent(values.phone)}`);
        } catch (error: any) {
             console.error('Request OTP error:', error);
             const message = error.response?.data?.message || 'Failed to send code. Please try again.';
            toast({
                variant: 'destructive',
                title: 'Access Denied',
                description: message,
            });
        }
    };


  return (
     <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Request Access</CardTitle>
          <CardDescription>Enter your mobile number to receive a one-time access code.</CardDescription>
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
                                    <Input placeholder="e.g., 0812345678" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full">Send Code</Button>
                </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account? <Button variant="link" className="p-0" asChild><Link href="/login">Sign In</Link></Button>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
