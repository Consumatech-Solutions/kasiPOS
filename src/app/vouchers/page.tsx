"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import { useVouchers } from "@/hooks/use-vouchers";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";
import { mutationQueue } from "@/lib/mutation-queue";
import { vouchersApi } from "@/lib/api/vouchers";
import type { Voucher } from "@/types";
import { format } from "date-fns";

const voucherSchema = z.object({
  code: z.string().min(1, { message: "Voucher code is required" }),
  type: z.enum(["percentage", "fixed"], {
    required_error: "Please select a discount type",
  }),
  value: z.coerce.number().positive({ message: "Value must be positive" }),
  minPurchase: z.coerce
    .number()
    .min(0, { message: "Minimum purchase cannot be negative" }),
  isActive: z.boolean().default(true),
  expiresAt: z.string().optional().nullable(),
  maxUses: z.coerce.number().int().positive().optional().nullable(),
  maxUsesPerCustomer: z.coerce.number().int().positive().optional().nullable(),
});

export default function VouchersPage() {
  const { isOnline, hasInternet } = useNetworkStatus();
  const {
    vouchers,
    loading,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVouchers({ page: 1, limit: 10 });
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(
    undefined
  );

  const form = useForm<z.infer<typeof voucherSchema>>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      code: "",
      type: "percentage",
      value: 0,
      minPurchase: 0,
      isActive: true,
      expiresAt: null,
      maxUses: null,
      maxUsesPerCustomer: null,
    },
  });

  const openVoucherDialog = (voucher?: Voucher) => {
    if (voucher) {
      setEditingVoucher(voucher);
      form.reset({
        code: voucher.code,
        type: voucher.type,
        value: Number(voucher.value),
        minPurchase: Number(voucher.minPurchase),
        isActive: voucher.isActive,
        expiresAt: voucher.expiresAt || null,
        maxUses: voucher.maxUses ?? null,
        maxUsesPerCustomer: voucher.maxUsesPerCustomer ?? null,
      });
    } else {
      setEditingVoucher(null);
      form.reset({
        code: "",
        type: "percentage",
        value: 0,
        minPurchase: 0,
        isActive: true,
        expiresAt: null,
        maxUses: null,
        maxUsesPerCustomer: null,
      });
    }
    setVoucherDialogOpen(true);
  };

  const handleSubmit = async (values: z.infer<typeof voucherSchema>) => {
    try {
      const voucherData = {
        ...values,
        code: values.code.toUpperCase(),
        expiresAt: values.expiresAt || undefined,
      };

      if (editingVoucher?.id) {
        if (isOnline) {
          await updateVoucher(editingVoucher.id, voucherData);
          feedback.success("Voucher updated", "Voucher updated successfully.");
        } else {
          mutationQueue.add({
            mutationKey: ["vouchers", "update"],
            mutationFn: () =>
              vouchersApi.update(editingVoucher.id as string, voucherData),
            variables: { id: editingVoucher.id, data: voucherData },
          });
          feedback.success(
            "Queued",
            "Voucher update queued. Will sync when online."
          );
        }
      } else {
        if (isOnline) {
          await createVoucher(voucherData);
          feedback.success("Voucher created", "Voucher created successfully.");
        } else {
          mutationQueue.add({
            mutationKey: ["vouchers", "create"],
            mutationFn: () => vouchersApi.create(voucherData),
            variables: voucherData,
          });
          feedback.success("Queued", "Voucher queued. Will sync when online.");
        }
      }
      setVoucherDialogOpen(false);
    } catch (error: unknown) {
      feedback.fromError(
        error,
        "Failed to save voucher",
        "Check your connection and try again.",
        ERROR_CODES.VOUCHER
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isOnline) {
        await deleteVoucher(id);
        feedback.success("Voucher deleted", "Voucher deleted successfully.");
      } else {
        mutationQueue.add({
          mutationKey: ["vouchers", "delete"],
          mutationFn: () => vouchersApi.delete(id),
          variables: { id },
        });
        feedback.success(
          "Queued",
          "Voucher deletion queued. Will sync when online."
        );
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        "Failed to delete voucher",
        "Try again or check your connection.",
        ERROR_CODES.VOUCHER
      );
    }
  };

  const filteredVouchers =
    filterActive !== undefined
      ? vouchers.filter((v) => v.isActive === filterActive)
      : vouchers;

  const getExpirationStatus = (voucher: Voucher) => {
    if (!voucher.expiresAt) return null;
    const expiresAt = new Date(voucher.expiresAt);
    const now = new Date();
    if (expiresAt < now)
      return { text: "Expired", variant: "destructive" as const };
    const daysUntil = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 7)
      return {
        text: `Expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
        variant: "secondary" as const,
      };
    return {
      text: format(expiresAt, "MMM d, yyyy"),
      variant: "outline" as const,
    };
  };

  return (
    <div className="p-2 sm:p-4 overflow-y-auto h-full">
      <div
        className={cn(
          !hasInternet && "opacity-60 pointer-events-none select-none"
        )}
      >
        <Card>
          <div className="sticky top-0 z-20 bg-card border-b shadow-[0_1px_0_0_hsl(var(--border))]">
            <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Voucher Management
                </CardTitle>
                <CardDescription className="text-sm">
                  Create and manage your discount vouchers.
                </CardDescription>
              </div>
              <Button
                onClick={() => openVoucherDialog()}
                className="w-full sm:w-auto min-h-[44px] touch-target"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Voucher
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 pb-4">
                <Button
                  variant={filterActive === undefined ? "default" : "outline"}
                  size="sm"
                  className="min-h-[44px] touch-target"
                  onClick={() => setFilterActive(undefined)}
                >
                  All
                </Button>
                <Button
                  variant={filterActive === true ? "default" : "outline"}
                  size="sm"
                  className="min-h-[44px] touch-target"
                  onClick={() => setFilterActive(true)}
                >
                  Active
                </Button>
                <Button
                  variant={filterActive === false ? "default" : "outline"}
                  size="sm"
                  className="min-h-[44px] touch-target"
                  onClick={() => setFilterActive(false)}
                >
                  Inactive
                </Button>
              </div>
            </CardContent>
          </div>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">
                Loading vouchers...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Type
                      </TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Min. Purchase
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Expiration
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Usage
                      </TableHead>
                      <TableHead className="hidden sm:table-cell text-right">
                        Status
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers && filteredVouchers.length > 0 ? (
                      filteredVouchers.map((voucher: any) => {
                        const expirationStatus = getExpirationStatus(voucher);
                        const value = Number(voucher.value);
                        const minPurchase = Number(voucher.minPurchase);
                        return (
                          <TableRow key={voucher.id}>
                            <TableCell className="font-mono font-medium">
                              <div className="flex flex-col">
                                <span>{voucher.code}</span>
                                <span className="text-xs text-muted-foreground md:hidden capitalize">
                                  {voucher.type}
                                </span>
                                <span className="text-xs text-muted-foreground sm:hidden">
                                  <Badge
                                    variant={
                                      voucher.isActive ? "default" : "secondary"
                                    }
                                    className="mt-1 w-fit"
                                  >
                                    {voucher.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell capitalize">
                              {voucher.type}
                            </TableCell>
                            <TableCell>
                              {voucher.type === "percentage"
                                ? `${value}%`
                                : `R${value.toFixed(2)}`}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              R{minPurchase.toFixed(2)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {expirationStatus ? (
                                <Badge variant={expirationStatus.variant}>
                                  {expirationStatus.text}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">
                                  No expiration
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {voucher.maxUses !== null ? (
                                <span className="text-sm">
                                  {voucher.currentUses || 0} / {voucher.maxUses}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {voucher.currentUses || 0} uses
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right">
                              <Badge
                                variant={
                                  voucher.isActive ? "default" : "secondary"
                                }
                              >
                                {voucher.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 sm:gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="touch-target"
                                  onClick={() => openVoucherDialog(voucher)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="touch-target"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-lg sm:text-xl">
                                        Are you sure?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm">
                                        This action cannot be undone. This will
                                        permanently delete the voucher.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                      <AlertDialogCancel
                                        className="min-h-[44px] touch-target w-full sm:w-auto"
                                        disabled={isDeleting}
                                      >
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="min-h-[44px] touch-target w-full sm:w-auto"
                                        onClick={() => handleDelete(voucher.id)}
                                        disabled={isDeleting}
                                      >
                                        {isDeleting && (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        {isDeleting ? "Deleting..." : "Delete"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24">
                          No vouchers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Voucher Dialog */}
        <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingVoucher ? "Edit Voucher" : "Create Voucher"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editingVoucher
                  ? "Update voucher details. Code cannot be changed after creation."
                  : "Create a new discount voucher for your store."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voucher Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="SAVE10"
                          disabled={!!editingVoucher}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select discount type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch("type") === "percentage"
                          ? "Percentage (%)"
                          : "Amount (R)"}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="minPurchase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Purchase (R)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(e.target.value || null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Uses (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null
                              )
                            }
                            placeholder="Unlimited"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxUsesPerCustomer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Per Customer (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null
                              )
                            }
                            placeholder="Unlimited"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Voucher can be redeemed when active
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-[44px] touch-target w-full sm:w-auto"
                      disabled={isCreating || isUpdating}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                    disabled={isCreating || isUpdating}
                  >
                    {(isCreating || isUpdating) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingVoucher
                      ? isUpdating
                        ? "Updating..."
                        : "Update"
                      : isCreating
                        ? "Creating..."
                        : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
