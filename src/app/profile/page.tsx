"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

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
import { useSettings } from "@/components/settings-provider";
import { authApi } from "@/lib/api";
import type { User } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

export default function ProfilePage() {
  const router = useRouter();
  const { settings, login } = useSettings();
  const { currentUser } = settings;

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentUser?.name || "",
      phone: currentUser?.phone || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!currentUser) {
      feedback.error(
        "Error",
        "No user is logged in.",
        "Sign in again and try again."
      );
      return;
    }

    const nameChanged = values.name !== currentUser.name;
    const phoneChanged = values.phone !== currentUser.phone;

    if (!phoneChanged && !nameChanged) {
      feedback.success("No changes", "You have not made any changes.");
      return;
    }

    if (phoneChanged) {
      feedback.error(
        "Operation not allowed",
        "Updating phone number is not supported yet.",
        "Please contact admin."
      );
      return;
    }

    try {
      const response = await authApi.updateProfile({ name: values.name });

      const updatedUser = response.data;

      const accessToken = localStorage.getItem("token");
      if (accessToken) {
        await login({ ...updatedUser, accessToken } as User & {
          accessToken?: string;
        });
      } else {
        await login(updatedUser);
      }

      feedback.success(
        "Profile updated",
        "Your name has been successfully updated."
      );
      router.push("/");
    } catch (error: any) {
      feedback.fromError(
        error,
        "Update failed",
        "Check your connection and try again."
      );
    }
  };

  return (
    <div className="p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>
                Manage your personal information.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled
                        title="Contact admin to change phone number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
