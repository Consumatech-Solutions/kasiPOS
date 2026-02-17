'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/catalogue/image-upload';
import { useState } from 'react';

const storeSchema = z.object({
  name: z.string().min(2, { message: "Store name must be at least 2 characters." }),
  vatNumber: z.string().optional(),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
});

interface StoreFormProps {
  store?: Store;
  onSubmit: (data: CreateStoreDto | UpdateStoreDto) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}

export function StoreForm({ store, onSubmit, onCancel, disabled = false }: StoreFormProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(store?.logoUrl || null);

  const form = useForm<z.infer<typeof storeSchema>>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: store?.name || '',
      vatNumber: store?.vatNumber || '',
      receiptHeader: store?.receiptHeader || '',
      receiptFooter: store?.receiptFooter || '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof storeSchema>) => {
    const data: CreateStoreDto | UpdateStoreDto = {
      name: values.name,
      vatNumber: values.vatNumber || undefined,
      receiptHeader: values.receiptHeader || undefined,
      receiptFooter: values.receiptFooter || undefined,
      ...(store && logoUrl !== undefined && { logoUrl: logoUrl || undefined }),
    };
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. My Store" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vatNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VAT Number</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. 123456789" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {store && (
          <FormItem>
            <FormLabel>Store Logo</FormLabel>
            <ImageUpload
              productId={`store-${store.id}`}
              currentImageUrl={logoUrl}
              onUploadSuccess={(url) => setLogoUrl(url)}
              onUploadError={() => {}}
              onDelete={() => setLogoUrl(null)}
              maxSizeMB={2}
              disabled={disabled}
            />
          </FormItem>
        )}
        <FormField
          control={form.control}
          name="receiptHeader"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receipt Header</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="e.g. Thank you for your visit" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="receiptFooter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receipt Footer</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="e.g. See you soon!" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={disabled}>
            {store ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
