"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSettings } from "@/components/settings-provider";
import { useTranslation } from "react-i18next";
import { useParcels } from "@/hooks/use-parcels";
import type { Parcel } from "@/types";
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

export default function BophPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { settings } = useSettings();

  const collectionFormSchema = useMemo(
    () =>
      z.object({
        collectionCode: z
          .string()
          .min(1, { message: t("boph.collectionCodeRequired") }),
        collectingPersonName: z
          .string()
          .min(2, { message: t("boph.collectorNameRequired") }),
        collectingPersonPhone: z.string().optional(),
        collectingPersonId: z
          .string()
          .min(5, { message: t("boph.collectorIdRequired") }),
      }),
    [t]
  );

  const createParcelFormSchema = useMemo(
    () =>
      z.object({
        deliveryNumber: z
          .string()
          .min(1, { message: t("boph.deliveryRequired") }),
        customerName: z
          .string()
          .min(2, { message: t("boph.customerNameRequired") }),
      }),
    [t]
  );
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
    [allParcels]
  );
  const receivedParcels = useMemo(() => {
    const parcels = (allParcels || []).filter((p) => p.status === "Received");
    if (!collectionCodeInput) return parcels;
    return parcels.filter((p) =>
      p.collectionCode
        ?.toLowerCase()
        .includes(collectionCodeInput.toLowerCase())
    );
  }, [allParcels, collectionCodeInput]);
  const collectedParcels = useMemo(
    () => (allParcels || []).filter((p) => p.status === "Collected"),
    [allParcels]
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
    toast({
      title: t("common.copied"),
      description: t("common.copiedDescription"),
    });
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
        title: t("boph.parcelReceived"),
        description: t("boph.parcelReceivedDescription", {
          deliveryNumber: selectedParcel.deliveryNumber,
        }),
      });
      setIsReceiveModalOpen(false);
      setSelectedParcel(null);
      refreshParcels();
    } catch (error: any) {
      console.error("Failed to receive parcel:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t("boph.couldNotReceive");
      toast({
        variant: "destructive",
        title: t("common.error"),
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
    values: z.infer<typeof collectionFormSchema>
  ) => {
    if (!selectedParcel || !selectedParcel.id) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("boph.noParcelSelected"),
      });
      return;
    }
    if (selectedParcel.collectionCode !== values.collectionCode) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("boph.collectionCodeMismatch"),
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
        title: t("boph.parcelCollected"),
        description: t("boph.parcelCollectedDescription", {
          deliveryNumber: selectedParcel.deliveryNumber,
        }),
      });
      setIsCollectModalOpen(false);
      setSelectedParcel(null);
      refreshParcels();
    } catch (error: any) {
      console.error("Failed to collect parcel:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t("boph.couldNotCollect");
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: errorMessage,
      });
    }
  };

  return (
    <div className="p-2 sm:p-4">
      <RequireOnlineBanner />
      <div
        className={cn(
          !isOnline && "opacity-60 pointer-events-none select-none"
        )}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  {t("boph.title")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("boph.description")}
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full sm:w-auto min-h-[44px] touch-target"
              >
                {t("boph.addParcel")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="incoming">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="incoming" className="text-xs sm:text-sm">
                  {t("boph.tabIncoming")}
                </TabsTrigger>
                <TabsTrigger value="received" className="text-xs sm:text-sm">
                  {t("boph.tabReady")}
                </TabsTrigger>
                <TabsTrigger value="collected" className="text-xs sm:text-sm">
                  {t("boph.tabHistory")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="incoming">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>{t("boph.loadingParcels")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("boph.deliveryNumber")}</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              {t("boph.customer")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("common.actions")}
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
                                      {t("common.edit")}
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
                                      {t("common.delete")}
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="min-h-[44px] touch-target w-full sm:w-auto"
                                    onClick={() =>
                                      handleOpenReceiveModal(parcel)
                                    }
                                  >
                                    {t("boph.receive")}
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
                        <p>{t("boph.noIncoming")}</p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="received">
                <div className="relative my-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={t("boph.searchCollection")}
                    className="pl-10"
                    value={collectionCodeInput}
                    onChange={(e) => setCollectionCodeInput(e.target.value)}
                  />
                </div>
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>{t("boph.loadingParcels")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("boph.collectionNumber")}</TableHead>
                            <TableHead className="hidden md:table-cell">
                              {t("boph.deliveryNumber")}
                            </TableHead>
                            <TableHead className="hidden sm:table-cell">
                              {t("boph.customer")}
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                              {t("boph.dateReceived")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("boph.action")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receivedParcels.map((parcel) => (
                            <TableRow key={parcel.id}>
                              <TableCell className="font-mono">
                                <div className="flex flex-col">
                                  <span>
                                    {parcel.collectionCode || t("common.na")}
                                  </span>
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
                                          "PPP"
                                        )
                                      : t("common.na")}
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
                                  {t("boph.issueParcel")}
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
                          <p>{t("boph.noCollectionCode")}</p>
                        ) : (
                          <p>{t("boph.noReady")}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="collected">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>{t("boph.loadingParcels")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("boph.deliveryNumber")}</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              {t("boph.customer")}
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              {t("boph.collectedBy")}
                            </TableHead>
                            <TableHead>{t("boph.dateCollected")}</TableHead>
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
                                    {parcel.collectingPersonName || t("common.na")}
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
                                      "PPP p"
                                    )
                                  : t("common.na")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {collectedParcels.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground">
                        <p>{t("boph.noCollectedYet")}</p>
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
                {t("boph.receiveParcel", {
                  deliveryNumber: selectedParcel?.deliveryNumber ?? "",
                })}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t("boph.receiveDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t("boph.courierReceiptCode")}
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
                {t("common.cancel")}
              </Button>
              <Button
                className="min-h-[44px] touch-target w-full sm:w-auto"
                onClick={handleConfirmReception}
                disabled={isReceiving}
              >
                {isReceiving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isReceiving ? t("boph.receiving") : t("boph.confirmReceive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {t("boph.issueToCustomer")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t("boph.issueDescription")}
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
                      <FormLabel>{t("boph.collectionCode")}</FormLabel>
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
                      <FormLabel>{t("boph.collectorFullName")}</FormLabel>
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
                      <FormLabel>{t("boph.collectorMobileOptional")}</FormLabel>
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
                      <FormLabel>{t("boph.collectorIdNumber")}</FormLabel>
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
                      {t("common.cancel")}
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
                    {isCollecting
                      ? t("boph.collecting")
                      : t("boph.confirmCollection")}
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
                {t("boph.addNewParcel")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t("boph.addNewDescription")}
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
                        title: t("boph.parcelAdded"),
                        description: t("boph.parcelAddedDescription", {
                          deliveryNumber: values.deliveryNumber,
                        }),
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
                        title: t("boph.parcelAddedOffline"),
                        description: t("boph.parcelAddedOfflineDescription"),
                      });
                      setIsCreateModalOpen(false);
                      createParcelForm.reset();
                    }
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      t("boph.couldNotCreate");
                    toast({
                      variant: "destructive",
                      title: t("common.error"),
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
                      <FormLabel>{t("boph.deliveryNumberLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("boph.deliveryPlaceholder")}
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
                      <FormLabel>{t("boph.customerNameLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("boph.customerPlaceholder")}
                        />
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
                      {t("common.cancel")}
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
                    {isCreating ? t("boph.creating") : t("boph.createParcel")}
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
                {t("boph.editParcel")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t("boph.editDescription")}
              </DialogDescription>
            </DialogHeader>
            <Form {...editParcelForm}>
              <form
                onSubmit={editParcelForm.handleSubmit(async (values) => {
                  if (!selectedParcel?.id) return;

                  try {
                    await updateParcel(selectedParcel.id, {
                      deliveryNumber: values.deliveryNumber,
                      customerName: values.customerName,
                    });
                    toast({
                      title: t("boph.parcelUpdated"),
                      description: t("boph.parcelUpdatedDescription", {
                        deliveryNumber: values.deliveryNumber,
                      }),
                    });
                    setIsEditModalOpen(false);
                    setSelectedParcel(null);
                    editParcelForm.reset();
                    refreshParcels();
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      t("boph.couldNotUpdate");
                    toast({
                      variant: "destructive",
                      title: t("common.error"),
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
                      <FormLabel>{t("boph.deliveryNumberLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("boph.deliveryPlaceholder")}
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
                      <FormLabel>{t("boph.customerNameLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("boph.customerPlaceholder")}
                        />
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
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="min-h-[44px] touch-target w-full sm:w-auto"
                  >
                    {t("boph.updateParcel")}
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
                {t("boph.deleteTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                {t("boph.deleteDescription", {
                  deliveryNumber: parcelToDelete?.deliveryNumber ?? "",
                  customerName: parcelToDelete?.customerName ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel
                className="min-h-[44px] touch-target w-full sm:w-auto"
                onClick={() => {
                  setParcelToDelete(null);
                }}
              >
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-[44px] touch-target w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!parcelToDelete?.id) return;

                  try {
                    await deleteParcel(parcelToDelete.id);
                    toast({
                      title: t("boph.parcelDeleted"),
                      description: t("boph.parcelDeletedDescription", {
                        deliveryNumber: parcelToDelete.deliveryNumber,
                      }),
                    });
                    setIsDeleteDialogOpen(false);
                    setParcelToDelete(null);
                    refreshParcels();
                  } catch (error: any) {
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.message ||
                      t("boph.couldNotDelete");
                    toast({
                      variant: "destructive",
                      title: t("common.error"),
                      description: errorMessage,
                    });
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isDeleting ? t("boph.deleting") : t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
