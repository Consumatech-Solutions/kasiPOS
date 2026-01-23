"use client";

import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSettings } from "@/components/settings-provider";
import { useParcels } from "@/hooks/use-parcels";
import type { Parcel } from "@/lib/api/parcels";

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
import { ClipboardCopy, Search, Plus, Edit, Trash2 } from "lucide-react";
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
  customerName: z
    .string()
    .min(2, { message: "Customer name is required." }),
});

export default function BophPage() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { currentStore } = settings;

  const {
    parcels: allParcels,
    loading,
    refresh: refreshParcels,
    receiveParcel,
    collectParcel,
    createParcel,
    updateParcel,
    deleteParcel,
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

  // Function to generate a random alphanumeric code
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
    if (!selectedParcel || !currentStore || !selectedParcel.id) return;

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
      collectingPersonName: parcel.customerName, // Pre-fill with original customer name
      collectingPersonPhone: "",
      collectingPersonId: "",
    });
    setIsCollectModalOpen(true);
  };

  const handleConfirmCollection = async (
    values: z.infer<typeof collectionFormSchema>,
  ) => {
    if (!selectedParcel || !currentStore || !selectedParcel.id) {
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
    <div className="p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>BOPH - Buy Online, Pickup Here</CardTitle>
              <CardDescription>
                Manage incoming and received parcels for customer pickup.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Add Parcel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incoming">
            <TabsList>
              <TabsTrigger value="incoming">Incoming Parcels</TabsTrigger>
              <TabsTrigger value="received">Ready for Collection</TabsTrigger>
              <TabsTrigger value="collected">Collection History</TabsTrigger>
            </TabsList>

            <TabsContent value="incoming">
              {loading ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p>Loading parcels...</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Delivery #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomingParcels.map((parcel) => (
                        <TableRow key={parcel.id}>
                          <TableCell className="font-mono">
                            {parcel.deliveryNumber}
                          </TableCell>
                          <TableCell>{parcel.customerName}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  editParcelForm.reset({
                                    deliveryNumber: parcel.deliveryNumber,
                                    customerName: parcel.customerName,
                                  });
                                  setSelectedParcel(parcel);
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setParcelToDelete(parcel);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleOpenReceiveModal(parcel)}
                              >
                                Receive
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collection #</TableHead>
                        <TableHead>Delivery #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date Received</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedParcels.map((parcel) => (
                        <TableRow key={parcel.id}>
                          <TableCell className="font-mono">
                            {parcel.collectionCode || "N/A"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {parcel.deliveryNumber}
                          </TableCell>
                          <TableCell>{parcel.customerName}</TableCell>
                          <TableCell>
                            {parcel.dateReceived
                              ? format(new Date(parcel.dateReceived), "PPP")
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleOpenCollectModal(parcel)}
                            >
                              Issue Parcel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Delivery #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Collected By</TableHead>
                        <TableHead>Date Collected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collectedParcels.map((parcel) => (
                        <TableRow key={parcel.id}>
                          <TableCell className="font-mono">
                            {parcel.deliveryNumber}
                          </TableCell>
                          <TableCell>{parcel.customerName}</TableCell>
                          <TableCell>
                            {parcel.collectingPersonName || "N/A"}
                          </TableCell>
                          <TableCell>
                            {parcel.dateCollected
                              ? format(new Date(parcel.dateCollected), "PPP p")
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

      {/* Receive Parcel Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive Parcel: {selectedParcel?.deliveryNumber}
            </DialogTitle>
            <DialogDescription>
              Provide the following code to the courier to confirm the handover.
              Once confirmed, the parcel will be marked as received.
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
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsReceiveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmReception}>Confirm & Receive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect Parcel Modal */}
      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Parcel to Customer</DialogTitle>
            <DialogDescription>
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
                    <FormLabel>Collector's Mobile Number (Optional)</FormLabel>
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Confirm Collection</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Parcel Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Parcel</DialogTitle>
            <DialogDescription>
              Create a new incoming parcel for customer pickup.
            </DialogDescription>
          </DialogHeader>
          <Form {...createParcelForm}>
            <form
              onSubmit={createParcelForm.handleSubmit(async (values) => {
                if (!currentStore) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No store context found.",
                  });
                  return;
                }

                try {
                  await createParcel({
                    storeId: currentStore.id!,
                    deliveryNumber: values.deliveryNumber,
                    customerName: values.customerName,
                  });
                  toast({
                    title: "Parcel Added",
                    description: `Parcel ${values.deliveryNumber} has been added successfully.`,
                  });
                  setIsCreateModalOpen(false);
                  createParcelForm.reset();
                  refreshParcels();
                } catch (error: any) {
                  console.error("Failed to create parcel:", error);
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Create Parcel</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Parcel Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parcel</DialogTitle>
            <DialogDescription>
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
                  console.error("Failed to update parcel:", error);
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Update Parcel</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
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
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setParcelToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
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
                  console.error("Failed to delete parcel:", error);
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
