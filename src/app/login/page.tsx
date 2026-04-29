"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { useSettings } from "@/components/settings-provider";
import { feedback } from "@/lib/feedback";
import { ERROR_CODES } from "@/lib/error-codes";

const loginSchema = z.object({
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function LoginPage() {
  const { login } = useSettings();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      const response = await authApi.login(values.phone, values.password);

      if (response.data && response.data.accessToken) {
        feedback.success("Login successful", "Welcome back!");
        await login({
          ...response.data.user,
          accessToken: response.data.accessToken,
        });
      }
    } catch (error: unknown) {
      const err = error as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: Record<string, unknown> };
      };
      const data = err?.response?.data;
      const status = err?.response?.status;

      if (process.env.NODE_ENV === "development" && err) {
        console.warn("[Login] Error details:", {
          status,
          data,
          code: err.code,
          message: err.message,
        });
      }

      if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "Backend not reachable. Ensure backend is running (e.g. NEXT_PUBLIC_API_URL or http://localhost:9002).",
          );
        }
        feedback.error(
          "Connection error",
          "Cannot reach server.",
          "Ensure the backend is running and try again.",
          { code: ERROR_CODES.LOGIN },
        );
        return;
      }

      const serverMessage =
        (typeof data?.message === "string" && data.message) ||
        (typeof (data as { error?: string })?.error === "string" &&
          (data as { error: string }).error) ||
        (typeof (data as { msg?: string })?.msg === "string" &&
          (data as { msg: string }).msg) ||
        (status === 401
          ? "Invalid phone number or password."
          : "Login failed. Please try again.");
      feedback.error(
        "Login failed",
        serverMessage,
        status === 401
          ? "Check your phone number and password."
          : "Try again or request access if you don't have an account.",
        { code: ERROR_CODES.LOGIN },
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Welcome Back!</CardTitle>
          <CardDescription className="text-sm">
            Enter your details to sign in to your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 0812345678"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        className="touch-target"
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
                Sign In
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            First time here?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/request-access">Request Access</Link>
            </Button>
            {" · "}
            Store admin?{" "}
            <Button
              variant="link"
              className="p-0 min-h-[44px] touch-target"
              asChild
            >
              <Link href="/set-password-store-admin">Set your password</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
