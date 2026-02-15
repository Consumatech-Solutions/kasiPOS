'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
import { useSettings } from '@/components/settings-provider';
import Link from 'next/link';

const setPasswordStoreAdminSchema = z.object({
  phone: z.string().min(10, { message: 'Please enter a valid mobile number.' }),
  temporaryPassword: z.string().min(1, { message: 'Temporary password from SMS is required.' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof setPasswordStoreAdminSchema>;

export default function SetPasswordStoreAdminPage() {
  const router = useRouter();
  const { login } = useSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(setPasswordStoreAdminSchema),
    defaultValues: {
      phone: '',
      temporaryPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await authApi.setPasswordStoreAdmin({
        phone: values.phone,
        temporaryPassword: values.temporaryPassword,
        newPassword: values.newPassword,
      });

      if (response.data?.accessToken && response.data?.user) {
        feedback.success('Password set', 'Your password has been set. You can now use the app.');
        await login({
          ...response.data.user,
          accessToken: response.data.accessToken,
        });
        router.push('/');
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; code?: string; message?: string };
      const status = err?.response?.status;
      const message = err?.response?.data?.message;

      if (status === 401) {
        feedback.error(
          'Invalid temporary password',
          message || 'The temporary password is invalid or your account is not a store admin.',
          'Check the SMS you received and try again.',
          { code: ERROR_CODES.SET_PASSWORD_STORE_ADMIN }
        );
        return;
      }
      if (status === 404) {
        feedback.error(
          'User not found',
          message || 'No account found for this phone number.',
          'Contact your administrator if you were expecting access.',
          { code: ERROR_CODES.SET_PASSWORD_STORE_ADMIN }
        );
        return;
      }
      feedback.fromError(
        error,
        'Set password failed',
        'Check your details and try again, or contact your administrator.',
        ERROR_CODES.SET_PASSWORD_STORE_ADMIN
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            You received an SMS with a temporary password. Enter your phone number, the temporary password, and choose a new password (min 8 characters).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 0812345678" className="touch-target" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="temporaryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary password (from SMS)</FormLabel>
                    <FormControl>
                      <Input type="password" className="touch-target" placeholder="From your SMS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" className="touch-target" {...field} />
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
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input type="password" className="touch-target" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full min-h-[44px] touch-target">
                Set password & continue
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Button variant="link" className="p-0 min-h-[44px] touch-target" asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
