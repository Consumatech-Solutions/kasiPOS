
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/components/settings-provider';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

const loginSchema = z.object({
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function LoginPage() {
    const { login } = useSettings();
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            phone: '',
            password: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof loginSchema>) => {
        const user = await db.users.where('phone').equals(values.phone).first();

        if (user && user.password && user.password === values.password) {
            toast({ title: "Login Successful", description: "Welcome back!" });
            login(user);
        } else {
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'Invalid mobile number or password.',
            });
        }
    };


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome Back!</CardTitle>
          <CardDescription>Enter your details to sign in to your store</CardDescription>
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
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full">Sign In</Button>
                </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
                First time here? <Button variant="link" className="p-0" asChild><Link href="/request-access">Request Access</Link></Button>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
