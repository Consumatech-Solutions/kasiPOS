"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";

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
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";

const verifyCodeSchema = z.object({
  code: z.string().length(6, { message: "Code must be 6 digits." }),
});

function VerifyCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams ? searchParams.get("phone") : null;

  const form = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof verifyCodeSchema>) => {
    if (!phone) {
      feedback.error(
        "Verification failed",
        "No phone number was provided.",
        "Go back to Request Access and enter your mobile number.",
        { code: ERROR_CODES.VERIFY },
      );
      router.push("/request-access");
      return;
    }

    try {
      const response = await authApi.verifyOtp(phone, values.code);

      if (response.data) {
        feedback.success(
          "Verification successful",
          "You can now continue to sign in or set your password.",
        );

        const { tempToken, hasPassword, user } = response.data;

        if (tempToken) {
          localStorage.setItem("kasi-pos-temp-token", tempToken);
        }

        if (hasPassword && user) {
          if (hasPassword) {
            router.push("/login");
          } else {
            router.push(`/set-password?phone=${encodeURIComponent(phone)}`);
          }
        } else {
          router.push(`/set-password?phone=${encodeURIComponent(phone)}`);
        }
      }
    } catch (error: unknown) {
      feedback.fromError(
        error,
        "Verification failed",
        "Check the code and try again, or request a new code from Request Access.",
        ERROR_CODES.VERIFY,
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Verify Your Code</CardTitle>
          <CardDescription>
            A 6-digit code was sent to your mobile number
            {phone ? ` ending in ...${phone.slice(-4)}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input placeholder="123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Verify & Continue
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Didn't get a code?{" "}
            <Button variant="link" className="p-0" asChild>
              <Link href="/request-access">Resend</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          Loading...
        </div>
      }
    >
      <VerifyCodeContent />
    </Suspense>
  );
}
