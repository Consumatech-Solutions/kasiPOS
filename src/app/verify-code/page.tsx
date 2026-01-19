'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { db } from '@/lib/db';

const verifyCodeSchema = z.object({
  code: z.string().length(6, { message: "Code must be 6 digits." }),
});

const MOCK_OTP_CODE = '123456';

export default function VerifyCodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const { toast } = useToast();
  const { login } = useSettings();

  const form = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      code: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof verifyCodeSchema>) => {
    if (!phone) {
        toast({ variant: 'destructive', title: 'Error', description: 'No phone number provided.' });
        router.push('/request-access');
        return;
    }

    if (values.code === MOCK_OTP_CODE) {
        const user = await db.users.where('phone').equals(phone).first();
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
            router.push('/request-access');
            return;
        }

        toast({
            title: 'Verification Successful!',
        });
        
        if (user.password) {
            login(user);
        } else {
            router.push(`/set-password?phone=${encodeURIComponent(phone)}`);
        }

    } else {
        toast({
            variant: 'destructive',
            title: 'Verification Failed',
            description: 'The code you entered is incorrect.',
        });
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Verify Your Code</CardTitle>
          <CardDescription>
            A 6-digit code was sent to your mobile number{phone ? ` ending in ...${phone.slice(-4)}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Verification Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="123456" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full">Verify & Continue</Button>
                </form>
            </Form>
             <p className="mt-4 text-center text-sm text-muted-foreground">
                Didn't get a code? <Button variant="link" className="p-0" asChild><Link href="/request-access">Resend</Link></Button>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
