"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSettings } from "@/components/settings-provider";
import { useParcels } from "@/hooks/use-parcels";
import type { Parcel } from "@/lib/api/parcels";
import { useEnsureStore } from "@/hooks/use-ensure-store";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { RequireOnlineBanner } from "@/components/require-online-banner";
import { cn } from "@/lib/utils";
import { mutationQueue } from "@/lib/mutation-queue";
import { parcelsApi } from "@/lib/api/parcels";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCopy,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

const collectionFormSchema = z.object({
  collectionCode: z
    .string()
    .min(1, { message: "Collection code is required." }),
  collectingPersonName: z
    .string()
    .min(2, { message: "Collector's name is required." }),
  collectingPersonPhone: z.string().optional(),
  collectingPersonId: z
    .string()
    .min(5, { message: "A valid ID/Passport number is required." }),
});

const createParcelFormSchema = z.object({
  deliveryNumber: z
    .string()
    .min(1, { message: "Delivery number is required." }),
  customerName: z.string().min(2, { message: "Customer name is required." }),
});

export default function BophPage() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { currentStore: settingsStore } = settings;
  const { ensureStore } = useEnsureStore();
  const { isOnline } = useNetworkStatus();

  const {
    parcels: allParcels,
    loading,
    refresh: refreshParcels,
    receiveParcel,
    collectParcel,
    createParcel,
    updateParcel,
    deleteParcel,
    isCreating,
    isReceiving,
    isCollecting,
    isUpdating,
    isDeleting,
  } = useParcels({
    autoLoad: true,
    limit: 10,
  });

  const [receiptCode, setReceiptCode] = useState("");
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelToDelete, setParcelToDelete] = useState<Parcel | null>(null);

  const [collectionCodeInput, setCollectionCodeInput] = useState("");

  const collectionForm = useForm<z.infer<typeof collectionFormSchema>>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      collectionCode: "",
      collectingPersonName: "",
      collectingPersonPhone: "",
      collectingPersonId: "",
    },
  });

  const createParcelForm = useForm<z.infer<typeof createParcelFormSchema>>({
    resolver: zodResolver(createParcelFormSchema),
    defaultValues: {
      deliveryNumber: "",
      customerName: "",
    },
  });

  const editParcelForm = useForm<z.infer<typeof createParcelFormSchema>>({
    resolver: zodResolver(createParcelFormSchema),
    defaultValues: {
      deliveryNumber: "",
      customerName: "",
    },
  });

  const incomingParcels = useMemo(
    () => (allParcels || []).filter((p) => p.status === "Incoming"),
    [allParcels],
  );
  const receivedParcels = useMemo(() => {
    const parcels = (allParcels || []).filter((p) => p.status === "Received");
    if (!collectionCodeInput) return parcels;
    return parcels.filter((p) =>
      p.collectionCode
        ?.toLowerCase()
        .includes(collectionCodeInput.toLowerCase()),
    );
  }, [allParcels, collectionCodeInput]);
  const collectedParcels = useMemo(
    () => (allParcels || []).filter((p) => p.status === "Collected"),
    [allParcels],
  );

  const generateCode = (length: number, prefix: string = "") => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + result;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Code copied to clipboard." });
  };

  const handleOpenReceiveModal = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    const newReceiptCode = generateCode(6, "RC-");
    setReceiptCode(newReceiptCode);
    setIsReceiveModalOpen(true);
  };

  const handleConfirmReception = async () => {
    if (!selectedParcel || !selectedParcel.id) return;

    const currentStore = await ensureStore();
    if (!currentStore) return;
    try {
      await receiveParcel(selectedParcel.id, { receiptCode });
      toast({
        title: "Parcel Received",
        description: `${selectedParcel.deliveryNumber} has been marked as received.`,
      });
      setIsReceiveModalOpen(false);
      setSelectedParcel(null);
      refreshParcels();
    } catch (error: any) {
      console.error("Failed to receive parcel:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Could not update the parcel status.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  const handleOpenCollectModal = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    collectionForm.reset({
      collectionCode: parcel.collectionCode ?? "",
      collectingPersonName: parcel.customerName,
      collectingPersonPhone: "",
      collectingPersonId: "",
    });
    setIsCollectModalOpen(true);
  };

  const handleConfirmCollection = async (
    values: z.infer<typeof collectionFormSchema>,
  ) => {
    if (!selectedParcel || !selectedParcel.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No parcel selected.",
      });
      return;
    }
    if (selectedParcel.collectionCode !== values.collectionCode) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Collection code does not match the selected parcel.",
      });
      return;
    }

    try {
      await collectParcel(selectedParcel.id, {
        collectionCode: values.collectionCode,
        collectingPersonName: values.collectingPersonName,
        collectingPersonId: values.collectingPersonId,
        collectingPersonPhone: values.collectingPersonPhone,
      });
      toast({
        title: "Parcel Collected",
        description: `${selectedParcel.deliveryNumber} has been issued to the customer.`,
      });
      setIsCollectModalOpen(false);
      setSelectedParcel(null);
      refreshParcels();
    } catch (error: any) {
      console.error("Failed to collect parcel:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Could not complete the collection.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  return (
    <div className="p-2 sm:p-4">
      <RequireOnlineBanner />
      <div
        className={cn(
          !isOnline && "opacity-60 pointer-events-none select-none",
        )}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  BOPH - Buy Online, Pickup Here
                </CardTitle>
                <CardDescription className="text-sm">
                  Manage incoming and received parcels for customer pickup.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full sm:w-auto min-h-[44px] touch-target"
              >
                Add Parcel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="incoming">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="incoming" className="text-xs sm:text-sm">
                  Incoming
                </TabsTrigger>
                <TabsTrigger value="received" className="text-xs sm:text-sm">
                  Ready
                </TabsTrigger>
                <TabsTrigger value="collected" className="text-xs sm:text-sm">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="incoming">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>Loading parcels...</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Delivery #</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Customer
                            </TableHead>
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incomingParcels.map((parcel) => (
                            <TableRow key={parcel.id}>
                              <TableCell className="font-mono">
                                <div className="flex flex-col">
                                  <span>{parcel.deliveryNumber}</span>
                                  <span className="text-xs text-muted-foreground sm:hidden">
                                    {parcel.customerName}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {parcel.customerName}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col sm:flex-row items-end sm:justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="min-h-[44px] touch-target w-full sm:w-auto"
                                    onClick={() => {
                                      editParcelForm.reset({
                                        deliveryNumber: parcel.deliveryNumber,
                                        customerName: parcel.customerName,
                                      });
                                      setSelectedParcel(parcel);
                                      setIsEditModalOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">
                                      Edit
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="min-h-[44px] touch-target w-full sm:w-auto"
                                    onClick={() => {
                                      setParcelToDelete(parcel);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">
                                      Delete
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="min-h-[44px] touch-target w-full sm:w-auto"
                                    onClick={() =>
                                      handleOpenReceiveModal(parcel)
                                    }
                                  >
                                    Receive
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {incomingParcels.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground">
                        <p>No parcels are currently expected.</p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="received">
                <div className="relative my-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by collection code..."
                    className="pl-10"
                    value={collectionCodeInput}
                    onChange={(e) => setCollectionCodeInput(e.target.value)}
                  />
                </div>
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>Loading parcels...</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Collection #</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Delivery #
                            </TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Customer
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                              Date Received
                            </TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receivedParcels.map((parcel) => (
                            <TableRow key={parcel.id}>
                              <TableCell className="font-mono">
                                <div className="flex flex-col">
                                  <span>{parcel.collectionCode || "N/A"}</span>
                                  <span className="text-xs text-muted-foreground md:hidden">
                                    {parcel.deliveryNumber}
                                  </span>
                                  <span className="text-xs text-muted-foreground sm:hidden">
                                    {parcel.customerName}
                                  </span>
                                  <span className="text-xs text-muted-foreground lg:hidden">
                                    {parcel.dateReceived
                                      ? format(
                                          new Date(parcel.dateReceived),
                                          "PPP",
                                        )
                                      : "N/A"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono hidden md:table-cell">
                                {parcel.deliveryNumber}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {parcel.customerName}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {parcel.dateReceived
                                  ? format(new Date(parcel.dateReceived), "PPP")
                                  : "N/A"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  className="min-h-[44px] touch-target w-full sm:w-auto"
                                  onClick={() => handleOpenCollectModal(parcel)}
                                >
                                  Issue Parcel
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {receivedParcels.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground">
                        {collectionCodeInput ? (
                          <p>No parcel found with that collection code.</p>
                        ) : (
                          <p>No parcels are currently ready for collection.</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="collected">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>Loading parcels...</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Delivery #</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Customer
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Collected By
                            </TableHead>
                            <TableHead>Date Collected</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collectedParcels.map((parcel) => (
                            <TableRow key={parcel.id}>
                              <TableCell className="font-mono">
                                <div className="flex flex-col">
                                  <span>{parcel.deliveryNumber}</span>
                                  <span className="text-xs text-muted-foreground sm:hidden">
                                    {parcel.customerName}
                                  </span>
                                  <span className="text-xs text-muted-foreground md:hidden">
                                    {parcel.collectingPersonName || "N/A"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {parcel.customerName}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {parcel.collectingPersonName || "N/A"}
                              </TableCell>
                              <TableCell>
                                {parcel.dateCollected
                                  ? format(
                                      new Date(parcel.dateCollected),
                                      "PPP p",
                                    )
                                  : "N/A"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {collectedParcels.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground">
                        <p>No parcels have been collected yet.</p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Receive Parcel: {selectedParcel?.deliveryNumber}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Provide the following code to the courier to confirm the
                handover. Once confirmed, the parcel will be marked as received.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Courier Receipt Code
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-4xl font-bold tracking-widest font-mono p-4 bg-muted rounded-lg">
                  {receiptCode}
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(receiptCode)}
                >
                  <ClipboardCopy className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                className="min-h-[44px] touch-target w-full sm:w-auto"
                onClick={() => setIsReceiveModalOpen(false)}
                disabled={isReceiving}
              >
                Cancel
              </Button>
              <Button
                className="min-h-[44px] touch-target w-full sm:w-auto"
                onClick={handleConfirmReception}
                disabled={isReceiving}
              >
                {isReceiving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isReceiving ? "Receiving..." : "Confirm & Receive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Issue Parcel to Customer
              </DialogTitle>
              <DialogDescription className="text-sm">
                Confirm collection code and capture the details of the person
                collecting the parcel.
              </DialogDescription>
            </DialogHeader>
            <Form {...collectionForm}>
              <form
                onSubmit={collectionForm.handleSubmit(handleConfirmCollection)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={collectionForm.control}
                  name="collectionCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          className="font-mono bg-muted"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={collectionForm.control}
                  name="collectingPersonName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collector's Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={collectionForm.control}
                  name="collectingPersonPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Collector's Mobile Number (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={collectionForm.control}
                  name="collectingPersonId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collector's ID / Passport Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-[44px] touch-target w-full sm:w-auto"
                      disabled={isCollecting}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                    disabled={isCollecting}
                  >
                    {isCollecting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isCollecting ? "Collecting..." : "Confirm Collection"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Add New Parcel
              </DialogTitle>
              <DialogDescription className="text-sm">
                Create a new incoming parcel for customer pickup.
              </DialogDescription>
            </DialogHeader>
            <Form {...createParcelForm}>
              <form
                onSubmit={createParcelForm.handleSubmit(async (values) => {
                  const currentStore = await ensureStore();
                  if (!currentStore) {
                    return;
                  }

                  const payload = {
                    storeId: currentStore.id!,
                    deliveryNumber: values.deliveryNumber,
                    customerName: values.customerName,
                  };

                  try {
                    if (isOnline) {
                      await createParcel(payload);
                      toast({
                        title: "Parcel Added",
                        description: `Parcel ${values.deliveryNumber} has been added successfully.`,
                      });
                      setIsCreateModalOpen(false);
                      createParcelForm.reset();
                      refreshParcels();
                    } else {
                      mutationQueue.add({
                        mutationKey: ["parcels", "create"],
                        mutationFn: () => parcelsApi.create(payload),
                        variables: payload,
                      });
                      toast({
                        title: "Queued",
                        description: "Parcel queued. Will sync when online.",
                      });
                      setIsCreateModalOpen(false);
                      createParcelForm.reset();
                    }
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      "Could not create the parcel.";
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: errorMessage,
                    });
                  }
                })}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={createParcelForm.control}
                  name="deliveryNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., DHL123456789"
                          className="font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createParcelForm.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Customer full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-[44px] touch-target w-full sm:w-auto"
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                    disabled={isCreating}
                  >
                    {isCreating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isCreating ? "Creating..." : "Create Parcel"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Edit Parcel
              </DialogTitle>
              <DialogDescription className="text-sm">
                Update the parcel information.
              </DialogDescription>
            </DialogHeader>
            <Form {...editParcelForm}>
              <form
                onSubmit={editParcelForm.handleSubmit(async (values) => {
                  if (!selectedParcel) return;

                  try {
                    await updateParcel(selectedParcel.id, {
                      deliveryNumber: values.deliveryNumber,
                      customerName: values.customerName,
                    });
                    toast({
                      title: "Parcel Updated",
                      description: `Parcel ${values.deliveryNumber} has been updated successfully.`,
                    });
                    setIsEditModalOpen(false);
                    setSelectedParcel(null);
                    editParcelForm.reset();
                    refreshParcels();
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      "Could not update the parcel.";
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: errorMessage,
                    });
                  }
                })}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={editParcelForm.control}
                  name="deliveryNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., DHL123456789"
                          className="font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editParcelForm.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Customer full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-[44px] touch-target w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                  >
                    Update Parcel
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl">
                Are you sure?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This action cannot be undone. This will permanently delete the
                parcel{" "}
                <span className="font-mono font-semibold">
                  {parcelToDelete?.deliveryNumber}
                </span>{" "}
                for customer{" "}
                <span className="font-semibold">
                  {parcelToDelete?.customerName}
                </span>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel
                className="min-h-[44px] touch-target w-full sm:w-auto"
                onClick={() => {
                  setParcelToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-[44px] touch-target w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!parcelToDelete) return;

                  try {
                    await deleteParcel(parcelToDelete.id);
                    toast({
                      title: "Parcel Deleted",
                      description: `Parcel ${parcelToDelete.deliveryNumber} has been deleted successfully.`,
                    });
                    setIsDeleteDialogOpen(false);
                    setParcelToDelete(null);
                    refreshParcels();
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      "Could not delete the parcel.";
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: errorMessage,
                    });
                  }
                }}
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
    </div>
  );
}
