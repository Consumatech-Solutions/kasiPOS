"use client";

import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "@/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  contact: z.string().min(1, { message: "Contact is required." }),
  loyaltyPoints: z.coerce
    .number()
    .int()
    .min(0, { message: "Loyalty points cannot be negative." })
    .optional(),
});

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (data: CreateCustomerDto | UpdateCustomerDto) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function CustomerForm({
  customer,
  onSubmit,
  onCancel,
  disabled = false,
  isLoading = false,
}: CustomerFormProps) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || "",
      contact: customer?.contact || "",
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
              <FormLabel>{t("customers.form.labelName")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("customers.form.placeholderName")}
                  disabled={disabled}
                />
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
              <FormLabel>{t("customers.form.labelContact")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("customers.form.placeholderContact")}
                  disabled={disabled}
                />
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
              <FormLabel>{t("customers.form.labelLoyalty")}</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={disabled || isLoading}
            className="min-h-[44px] touch-target"
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={disabled || isLoading}
            className="min-h-[44px] touch-target"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {customer
              ? isLoading
                ? t("customers.form.updating")
                : t("customers.form.update")
              : isLoading
                ? t("customers.form.creating")
                : t("customers.form.create")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
