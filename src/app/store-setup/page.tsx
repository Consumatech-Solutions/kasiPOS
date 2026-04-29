"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { useSettings } from "@/components/settings-provider";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  ScanLine,
  CreditCard,
  Sparkles,
  MoveRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { feedback } from "@/lib/feedback";
import { ImageUpload } from "@/components/catalogue/image-upload";

const businessInfoSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Store name must be at least 3 characters." }),
  vatNumber: z.string().optional(),
});

const receiptSchema = z.object({
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
});

type FormData = z.infer<typeof businessInfoSchema> &
  z.infer<typeof receiptSchema>;

const TOTAL_STEPS = 4;

export default function StoreSetupPage() {
  const router = useRouter();
  const { settings, setSetting } = useSettings();
  const { currentStore } = settings;
  const { updateStore, createStore } = useStore();
  const [step, setStep] = useState(1);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    currentStore?.logoUrl || null
  );

  const form = useForm<FormData>({
    resolver: zodResolver(
      step === 1 ? (businessInfoSchema as any) : (receiptSchema as any)
    ),
    defaultValues: {
      name: currentStore?.name || "",
      vatNumber: currentStore?.vatNumber || "",
      receiptHeader:
        currentStore?.receiptHeader || "Thank you for your purchase!",
      receiptFooter:
        currentStore?.receiptFooter || "Find us on social media @KasiPOS",
    },
  });

  const { watch } = form;
  const watchedReceiptHeader = watch("receiptHeader");
  const watchedReceiptFooter = watch("receiptFooter");

  const onNext = async () => {
    let isValid = true;
    if (step === 1) {
      isValid = await form.trigger(["name", "vatNumber"]);
    } else if (step === 2) {
      isValid = await form.trigger(["receiptHeader", "receiptFooter"]);
    }

    if (!isValid) return;

    try {
      const currentData = form.getValues();

      if (currentStore && currentStore.id) {
        const updateData: any = {
          ...currentData,
          ...(logoUrl !== null && { logoUrl }),
        };
        await updateStore(currentStore.id, updateData);

        const updatedStore = {
          ...currentStore,
          ...updateData,
        };
        setSetting("currentStore", updatedStore);
      } else {
        const createData: any = {
          ...currentData,
          ...(logoUrl && { logoUrl }),
        };
        const created = await createStore(createData);
        setSetting("currentStore", created);
      }

      if (step < TOTAL_STEPS) {
        setStep((s) => s + 1);
      } else {
        if (currentStore && currentStore.id) {
          await updateStore(currentStore.id, { isSetupComplete: true });
          setSetting("currentStore", {
            ...currentStore,
            isSetupComplete: true,
          });
        }
        feedback.success("Store setup completed", "Store setup completed!");
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to save store:", error);
      feedback.fromError(
        error,
        "Failed to save store",
        "Check your connection and try again."
      );
    }
  };

  const onBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Form {...form}>
            <form className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sipho's Spaza" {...field} />
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
                    <FormLabel>VAT Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your VAT number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {currentStore && (
                <div>
                  <FormLabel>Store logo (Optional)</FormLabel>
                  <div className="mt-2">
                    <ImageUpload
                      productId={`store-${currentStore.id}`}
                      currentImageUrl={logoUrl}
                      onUploadSuccess={(url) => setLogoUrl(url)}
                      onUploadError={() => {}}
                      onDelete={() => setLogoUrl(null)}
                      maxSizeMB={2}
                      disabled={false}
                    />
                  </div>
                </div>
              )}
            </form>
          </Form>
        );
      case 2:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="receiptHeader"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Header Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Thank you for shopping with us!"
                          {...field}
                        />
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
                      <FormLabel>Receipt Footer Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Follow us on social media!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <div>
              <Label>Receipt Preview</Label>
              <div className="mt-2 p-4 border rounded-md bg-muted/50 h-full">
                <div className="bg-white p-6 max-w-sm mx-auto shadow-sm font-mono text-xs">
                  <div className="text-center">
                    <Image
                      src="/logo-placeholder.svg"
                      alt="Store Logo"
                      width={80}
                      height={80}
                      className="mx-auto mb-2"
                    />
                    <h2 className="text-sm font-bold">
                      {currentStore?.name || "Your Store Name"}
                    </h2>
                    <p>VAT#: {currentStore?.vatNumber || "N/A"}</p>
                    <Separator className="my-2 border-dashed" />
                    <p className="text-center italic">{watchedReceiptHeader}</p>
                    <Separator className="my-2 border-dashed" />
                  </div>
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between">
                      <span>Item 1</span>
                      <span>R12.50</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Item 2</span>
                      <span>R18.00</span>
                    </div>
                  </div>
                  <Separator className="my-2 border-dashed" />
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>R30.50</span>
                  </div>
                  <Separator className="my-2 border-dashed" />
                  <p className="text-center italic">{watchedReceiptFooter}</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold">Hardware Setup</h3>
            <p className="text-muted-foreground mt-2">
              Connect your receipt printer, barcode scanner, and card reader.
              You can also do this later from the settings.
            </p>
            <div className="flex justify-center gap-8 md:gap-16 mt-8">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Printer className="h-16 w-16" />
                <span>Receipt Printer</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ScanLine className="h-16 w-16" />
                <span>Barcode Scanner</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <CreditCard className="h-16 w-16" />
                <span>Card Reader</span>
              </div>
            </div>
            <Button variant="outline" className="mt-12" onClick={onNext}>
              Skip for now
            </Button>
          </div>
        );
      case 4:
        return (
          <div className="text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full w-fit">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-4">You're All Set!</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Your store is ready. You can now start adding products to your
              catalogue and making sales. You can manage your store settings at
              any time from the main menu.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const getStepTitle = (currentStep: number) => {
    switch (currentStep) {
      case 1:
        return "Tell us about your business";
      case 2:
        return "Customize your receipts";
      case 3:
        return "Set up your hardware";
      case 4:
        return "Setup Complete!";
      default:
        return "Store Setup";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="space-y-2 mb-6">
            <Progress value={(step / TOTAL_STEPS) * 100} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>
          <CardTitle className="text-3xl">{getStepTitle(step)}</CardTitle>
          {step === 1 && (
            <CardDescription>
              Let's start with the basics. You can change these details later.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="min-h-[400px] flex flex-col justify-center">
          {renderStep()}
        </CardContent>
        <div className="p-6 pt-0 flex justify-between items-center">
          <div>
            {step > 1 && step < 4 && (
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            )}
          </div>
          <div>
            {step < 4 ? (
              <Button onClick={onNext}>Save & Continue</Button>
            ) : (
              <Button onClick={onNext}>
                Go to Dashboard <MoveRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
