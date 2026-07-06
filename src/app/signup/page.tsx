"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import {
  DEFAULT_PHONE_COUNTRY,
  formatE164,
  getPhoneCountry,
  validateLocalNumber,
} from "@/lib/phone";
import { PhoneNumberField } from "@/components/auth/phone-number-field";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { feedback, getErrorMessage } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";
import {
  backendUnreachableRecovery,
  isBackendConnectionError,
} from "@/lib/backend-connection";
import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";

const signupSchema = z
  .object({
    email: z.string().email({ message: "Please enter a valid email address." }),
    name: z.string().min(1, { message: "Your name is required." }),
    storeName: z.string().min(1, { message: "Store name is required." }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." }),
    countryCode: z.string().min(2, { message: "Country is required." }),
    localNumber: z.string().min(1, { message: "Mobile number is required." }),
  })
  .superRefine((data, ctx) => {
    const result = validateLocalNumber(data.countryCode, data.localNumber);
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
        path: ["localNumber"],
      });
    }
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      name: "",
      storeName: "",
      password: "",
      countryCode: DEFAULT_PHONE_COUNTRY.iso,
      localNumber: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const phoneValidation = validateLocalNumber(
      values.countryCode,
      values.localNumber
    );
    if (!phoneValidation.valid) {
      feedback.error("Invalid number", phoneValidation.message, undefined, {
        code: ERROR_CODES.SIGNUP,
      });
      return;
    }

    const country = getPhoneCountry(values.countryCode)!;
    const phoneNumber = formatE164(
      country.dialCode,
      values.localNumber,
      values.countryCode
    );

    try {
      const response = await authApi.signup({
        email: values.email.trim(),
        name: values.name.trim(),
        storeName: values.storeName.trim(),
        password: values.password,
        countryCode: values.countryCode,
        phoneNumber,
      });

      const channel = response.data?.verificationChannel ?? "email";
      const message =
        response.data?.message ??
        (channel === "sms"
          ? "Verification code sent to your mobile number."
          : "Verification code sent to your email.");

      feedback.success(
        channel === "sms" ? "Check your phone" : "Check your email",
        message
      );
      router.push(
        `/signup/verify?email=${encodeURIComponent(values.email.trim())}&channel=${channel}`
      );
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: Record<string, unknown> };
      };
      const status = err?.response?.status;
      if (status === 409) {
        feedback.error(
          "Already registered",
          "This email or phone is already registered.",
          "Sign in if you already have an account.",
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      if (isBackendConnectionError(error)) {
        feedback.error(
          "Backend not running",
          `Cannot reach the API at ${getConfiguredApiUrl()}.`,
          backendUnreachableRecovery(),
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      const message = getErrorMessage(error);
      if (status === 404 && /cannot post\s+\/auth\/signup/i.test(message)) {
        feedback.error(
          "Signup Failed, contact support",
          "Please contact support if you continue to experience issues.",
          undefined,
          { code: ERROR_CODES.SIGNUP }
        );
        return;
      }

      feedback.fromError(
        error,
        "Signup failed",
        "Check your details and try again.",
        ERROR_CODES.SIGNUP
      );
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            Create your store
          </CardTitle>
          <CardDescription className="text-sm">
            Register as a merchant. We&apos;ll send a verification code to your
            mobile (South Africa) or email (other countries).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="owner@example.com"
                        className="touch-target"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jane Doe"
                        className="touch-target"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jane's Shop"
                        className="touch-target"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="localNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile number</FormLabel>
                    <FormControl>
                      <PhoneNumberField
                        value={{
                          countryIso: form.watch("countryCode"),
                          localNumber: field.value,
                        }}
                        onChange={({ countryIso, localNumber }) => {
                          form.setValue("countryCode", countryIso, {
                            shouldValidate: true,
                          });
                          field.onChange(localNumber);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        className="touch-target"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full min-h-[44px] touch-target"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? "Continuing..." : "Continue"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
