"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";

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

const signupSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  name: z.string().min(1, { message: "Your name is required." }),
  storeName: z.string().min(1, { message: "Store name is required." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." }),
  phoneNumber: z.string().min(10, {
    message: "Please enter a valid mobile number (at least 10 digits).",
  }),
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
      phoneNumber: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const phoneNumber = normalizePhone(values.phoneNumber);
    if (phoneNumber.length < 10) {
      feedback.error(
        "Invalid number",
        "Please enter at least 10 digits.",
        undefined,
        { code: ERROR_CODES.SIGNUP }
      );
      return;
    }

    try {
      const response = await authApi.signup({
        email: values.email.trim(),
        name: values.name.trim(),
        storeName: values.storeName.trim(),
        password: values.password,
        phoneNumber,
      });

      const message =
        response.data?.message ?? "Verification code sent to your email.";
      feedback.success("Check your email", message);
      router.push(
        `/signup/verify?email=${encodeURIComponent(values.email.trim())}`
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
      const apiBase = getConfiguredApiUrl();
      if (status === 404 && /cannot post\s+\/auth\/signup/i.test(message)) {
        feedback.error(
          "Signup API not found",
          `POST ${apiBase}/auth/signup was not found.`,
          "Ensure the backend exposes POST /auth/signup and NEXT_PUBLIC_API_URL matches its port.",
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">
            Create your store
          </CardTitle>
          <CardDescription className="text-sm">
            Register as a merchant. We will email you a verification code.
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 0812345678"
                        className="touch-target"
                        autoComplete="tel"
                        {...field}
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
              >
                Continue
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
