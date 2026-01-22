'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const customerSchema = z.object({
  name: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères." }),
  contact: z.string().min(1, { message: "Le contact est requis." }),
  loyaltyPoints: z.coerce.number().int().min(0, { message: "Les points de fidélité ne peuvent pas être négatifs." }).optional(),
});

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (data: CreateCustomerDto | UpdateCustomerDto) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

export function CustomerForm({ customer, onSubmit, onCancel, disabled = false }: CustomerFormProps) {
  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || '',
      contact: customer?.contact || '',
      loyaltyPoints: customer?.loyaltyPoints || 0,
    },
  });

  const handleSubmit = async (values: z.infer<typeof customerSchema>) => {
    await onSubmit({
      name: values.name,
      contact: values.contact,
      loyaltyPoints: values.loyaltyPoints,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ex: John Doe" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact (Phone/Email) *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ex: +1234567890" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="loyaltyPoints"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Loyalty Points</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button type="submit" disabled={disabled}>
            {customer ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
