"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Moon,
  Sun,
  Languages,
  Info,
  PlusCircle,
  Edit,
  Trash2,
  Users,
  Key,
  RefreshCw,
  WifiOff,
  Receipt,
  Printer,
  CreditCard,
  Loader2,
  Crown,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/components/settings-provider";
import { usersApi, settingsApi } from "@/lib/api";
import { storesApi } from "@/lib/api/stores";
import { saveStorePermanently } from "@/lib/store-persistence";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { feedback, getErrorMessage } from "@/lib/feedback";
import { isNetworkErrorLike } from "@/lib/network-error";
import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffectiveOnline } from "@/hooks/use-effective-online";
import { useEnsureStore } from "@/hooks/use-ensure-store";
import { useHardwareSetup } from "@/components/hardware-setup/HardwareSetupProvider";
import {
  readStaffPageCache,
  writeStaffPageCache,
} from "@/lib/settings-staff-cache";
import { cn } from "@/lib/utils";
import type { PatchSettingsBody } from "@/lib/api/settings";

type Feature = "campaigns" | "marketplace" | "boph" | "buyStock";

const userManagementSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Please enter a valid email address." }),
  phone: z.string().min(10, { message: "Please enter a valid mobile number." }),
});

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z
      .string()
      .min(6, { message: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function SettingsPage() {
  const { settings, setSetting, logout } = useSettings();
  const { openHardwareSetup } = useHardwareSetup();
  const { currentUser, currentStore: settingsStore } = settings;
  const isAdmin =
    (currentUser != null &&
      String(currentUser.role ?? "").toLowerCase() === "admin") ||
    settingsStore?.ownerId === currentUser?.id ||
    currentUser?.role === "store_admin";
  const { ensureStore } = useEnsureStore();
  const { effectiveOnline, refreshEffectiveOnline } = useEffectiveOnline();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingModules, setIsUpdatingModules] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);
  const [storeSettingsCredit, setStoreSettingsCredit] = useState<{
    creditLimit: number;
    termType: "fixed" | "variable";
    term?: number;
  } | null>(null);
  const [creditForm, setCreditForm] = useState({
    enabled: false,
    creditLimit: 500,
    termType: "fixed" as "fixed" | "variable",
    term: 7,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [duplicatePhonePopupOpen, setDuplicatePhonePopupOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForPassword, setUserForPassword] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetUser, setTransferTargetUser] = useState<User | null>(
    null
  );
  const [deleteCurrentAdminOnTransfer, setDeleteCurrentAdminOnTransfer] =
    useState(false);
  const [isTransferringRole, setIsTransferringRole] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const TABLE_LIMIT = 5;

  const isDuplicatePhoneError = (error: unknown): boolean => {
    const err = error as {
      response?: {
        status?: number;
        data?: { message?: string; error?: string } | string;
      };
      message?: string;
    };
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = (
      (typeof data === "object" && data?.message) ||
      (typeof data === "object" && data?.error) ||
      (typeof data === "string" ? data : "") ||
      ""
    ).toLowerCase();
    if (status === 409) return true;
    if (
      status === 400 &&
      (msg.includes("phone") ||
        msg.includes("duplicate") ||
        msg.includes("already") ||
        msg.includes("exist"))
    )
      return true;
    if (status === 500) return true;
    return false;
  };

  const userManagementStoreId =
    settingsStore?.id ?? currentUser?.storeId ?? null;

  useEffect(() => {
    const needStore =
      (isAdmin || currentUser?.role === "store_admin") &&
      !userManagementStoreId;
    if (needStore) {
      ensureStore().catch(() => {});
    }
  }, [isAdmin, currentUser?.role, userManagementStoreId]);

  const fetchUsers = useCallback(async () => {
    if (!userManagementStoreId) {
      setUsers([]);
      setTotalPages(0);
      return;
    }
    if (!effectiveOnline) {
      const cached = await readStaffPageCache(userManagementStoreId, page);
      if (cached) {
        setUsers(cached.users);
        setTotalPages(cached.totalPages);
      } else {
        setUsers([]);
        setTotalPages(1);
      }
      return;
    }
    try {
      const response = await usersApi.findAll(
        userManagementStoreId,
        page,
        TABLE_LIMIT
      );
      const body = response.data;
      const list = Array.isArray(body?.data) ? body.data : [];
      const totalPages =
        typeof body?.meta?.totalPages === "number" ? body.meta.totalPages : 0;
      setUsers(list as User[]);
      setTotalPages(totalPages);
      await writeStaffPageCache(
        userManagementStoreId,
        page,
        list as User[],
        totalPages
      );
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
      setTotalPages(0);
    }
  }, [userManagementStoreId, page, effectiveOnline]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const settingsStoreId =
    currentUser?.storeId ?? settingsStore?.id ?? undefined;
  const isPlatformAdmin =
    currentUser != null &&
    String(currentUser.role ?? "").toLowerCase() === "admin";
  /** Platform admin selects store via query; store_admin uses JWT only. */
  const settingsApiStoreId = isPlatformAdmin ? settingsStoreId : undefined;

  useEffect(() => {
    if (!isAdmin && currentUser?.role !== "store_admin") return;
    if (!settingsStoreId) {
      setLoadingSettings(false);
      return;
    }

    if (!effectiveOnline) {
      setLoadingSettings(true);
      const c = settingsStore?.credit;
      const cc = c?.customerCredit;
      if (cc) {
        setStoreSettingsCredit({
          creditLimit: Number(cc.creditLimit ?? 0),
          termType: cc.termType === "variable" ? "variable" : "fixed",
          term: cc.term != null ? Number(cc.term) : 7,
        });
        setCreditForm({
          enabled: true,
          creditLimit: Number(cc.creditLimit ?? 0),
          termType: cc.termType === "variable" ? "variable" : "fixed",
          term: cc.term != null ? Number(cc.term) : 7,
        });
      } else if (c === null) {
        setStoreSettingsCredit(null);
        setCreditForm((f) => ({ ...f, enabled: false }));
      }
      setLoadingSettings(false);
      return;
    }

    setLoadingSettings(true);
    settingsApi
      .get(settingsApiStoreId)
      .then((res) => {
        const credit = res.data?.credit;
        const cc = credit?.customerCredit;
        if (cc) {
          setStoreSettingsCredit({
            creditLimit: Number(cc.creditLimit ?? 0),
            termType: cc.termType === "variable" ? "variable" : "fixed",
            term: cc.term != null ? Number(cc.term) : 7,
          });
          setCreditForm({
            enabled: true,
            creditLimit: Number(cc.creditLimit ?? 0),
            termType: cc.termType === "variable" ? "variable" : "fixed",
            term: cc.term != null ? Number(cc.term) : 7,
          });
          if (settingsStore && credit && !settingsStore.credit) {
            setSetting("currentStore", { ...settingsStore, credit });
          }
        } else {
          const fromStore = settingsStore?.credit?.customerCredit;
          if (fromStore) {
            setCreditForm({
              enabled: true,
              creditLimit: Number(fromStore.creditLimit ?? 500),
              termType:
                fromStore.termType === "variable" ? "variable" : "fixed",
              term: fromStore.term != null ? Number(fromStore.term) : 7,
            });
          }
        }
      })
      .catch(() => {
        const fromStore = settingsStore?.credit?.customerCredit;
        if (fromStore) {
          setCreditForm({
            enabled: true,
            creditLimit: Number(fromStore.creditLimit ?? 500),
            termType: fromStore.termType === "variable" ? "variable" : "fixed",
            term: fromStore.term != null ? Number(fromStore.term) : 7,
          });
        }
      })
      .finally(() => setLoadingSettings(false));
  }, [
    isAdmin,
    currentUser?.role,
    effectiveOnline,
    settingsApiStoreId,
    settingsStore?.credit,
    settingsStore?.id,
  ]);

  const userForm = useForm<z.infer<typeof userManagementSchema>>({
    resolver: zodResolver(userManagementSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const updateStoreModule = async (feature: Feature, enabled: boolean) => {
    const store = settings.currentStore;
    if (!store?.id) {
      setSetting(feature, enabled);
      return;
    }
    setIsUpdatingModules(true);
    try {
      const nextModules = { ...store.enabledModules, [feature]: enabled };
      const response = await storesApi.update(store.id, {
        enabledModules: nextModules,
      });
      if (response?.data) {
        setSetting("currentStore", response.data);
        await saveStorePermanently(response.data, setSetting);
      } else {
        setSetting(feature, enabled);
      }
    } catch (err: any) {
      console.error("Failed to update store modules:", err);
      feedback.error(
        "Update failed",
        err?.message ?? "Could not update feature. Try again."
      );
      setSetting(feature, !enabled);
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const updateShowVatInCheckout = async (checked: boolean) => {
    const store = settings.currentStore;
    if (!store?.id) {
      setSetting("showVatInCheckout", checked);
      return;
    }
    setIsUpdatingModules(true);
    try {
      const nextModules = {
        ...store.enabledModules,
        showVatInCheckout: checked,
      };
      const response = await storesApi.update(store.id, {
        enabledModules: nextModules,
      });
      if (response?.data) {
        setSetting("currentStore", response.data);
        await saveStorePermanently(response.data, setSetting);
      } else {
        setSetting("showVatInCheckout", checked);
      }
    } catch (err: any) {
      console.error("Failed to update showVatInCheckout:", err);
      feedback.error(
        "Update failed",
        err?.message ?? "Could not update setting. Try again."
      );
      setSetting("showVatInCheckout", !checked);
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const saveCreditSettings = async () => {
    if (!settingsStoreId) {
      feedback.error(
        "No store",
        "Load a store first or ensure your account has a store.",
        undefined,
        { code: "CREDIT" }
      );
      return;
    }
    if (!settingsStore) {
      feedback.error(
        "No store",
        "Load your store before saving credit settings.",
        undefined,
        { code: "CREDIT" }
      );
      return;
    }

    const creditLimit = Math.max(0, Number(creditForm.creditLimit) || 0);
    const termDays =
      creditForm.termType === "fixed"
        ? Math.max(1, Number(creditForm.term) || 7)
        : undefined;
    const body: PatchSettingsBody = creditForm.enabled
      ? {
          credit: {
            customerCredit: {
              creditLimit,
              termType: creditForm.termType,
              ...(creditForm.termType === "fixed" && { term: termDays }),
            },
          },
        }
      : { credit: null };

    const applyLocalCredit = async (
      normalizedCredit: typeof settingsStore.credit
    ) => {
      setSetting("currentStore", {
        ...settingsStore,
        credit: normalizedCredit,
      });
      await saveStorePermanently(
        { ...settingsStore, credit: normalizedCredit },
        setSetting
      );
      const cc =
        normalizedCredit &&
        typeof normalizedCredit === "object" &&
        "customerCredit" in normalizedCredit
          ? (
              normalizedCredit as {
                customerCredit: {
                  creditLimit?: number;
                  termType?: string;
                  term?: number;
                };
              }
            ).customerCredit
          : null;
      setStoreSettingsCredit(
        cc
          ? {
              creditLimit: Number(cc.creditLimit ?? 0),
              termType: cc.termType === "variable" ? "variable" : "fixed",
              term: cc.term,
            }
          : null
      );
      setCreditForm((f) =>
        cc
          ? {
              ...f,
              creditLimit: Number(cc.creditLimit ?? 0),
              termType: cc.termType === "variable" ? "variable" : "fixed",
              term: cc.term ?? 7,
            }
          : { ...f, enabled: false }
      );
    };

    if (!effectiveOnline) {
      feedback.error(
        "Server unavailable",
        "Connect to the internet and ensure the server is reachable to save credit settings.",
        undefined,
        { code: "CREDIT" }
      );
      return;
    }

    setSavingCredit(true);
    try {
      await settingsApi.patch(body, settingsApiStoreId);
      let updatedCredit: typeof settingsStore.credit = null;
      if (creditForm.enabled) {
        try {
          const verifyRes = await settingsApi.get(settingsApiStoreId);
          const verifyRaw = verifyRes.data as {
            credit?: unknown;
            data?: { credit?: unknown };
          };
          const verified = verifyRaw?.data?.credit ?? verifyRaw?.credit ?? null;
          if (
            verified != null &&
            typeof verified === "object" &&
            "customerCredit" in (verified as object)
          ) {
            updatedCredit = verified as typeof settingsStore.credit;
          }
        } catch (_) {}
      }
      if (updatedCredit == null && creditForm.enabled) {
        updatedCredit = (body.credit ?? null) as typeof settingsStore.credit;
      }
      const normalizedCredit = creditForm.enabled ? updatedCredit : null;
      await applyLocalCredit(normalizedCredit);

      const cc =
        normalizedCredit &&
        typeof normalizedCredit === "object" &&
        "customerCredit" in normalizedCredit
          ? (
              normalizedCredit as {
                customerCredit: {
                  creditLimit?: number;
                  termType?: string;
                  term?: number;
                };
              }
            ).customerCredit
          : null;
      if (creditForm.enabled && !cc) {
        feedback.error(
          "Saved but not confirmed on server",
          "Credit settings were sent, but the server did not return the stored config.",
          "Check store settings on the server, then try a credit sale again.",
          { code: "CREDIT" }
        );
      } else {
        feedback.success(
          "Credit settings saved",
          "Customer credit configuration has been updated."
        );
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: unknown; status?: number };
        message?: string;
        code?: string;
      };
      const message = getErrorMessage(err);
      const recovery = isNetworkErrorLike(err)
        ? `Start the KasiPOS API (default ${getConfiguredApiUrl()}), set NEXT_PUBLIC_API_URL in .env if needed, then restart npm run dev.`
        : ax?.response?.status === 404
          ? "PATCH /settings is not available on the API you are using. Check NEXT_PUBLIC_API_URL."
          : undefined;
      if (process.env.NODE_ENV === "development") {
        console.error("[Credit settings] PATCH /settings failed", {
          status: ax?.response?.status,
          data: ax?.response?.data,
          code: ax?.code,
          message: ax?.message ?? (err as Error)?.message,
          apiUrl: getConfiguredApiUrl(),
        });
      }
      feedback.error("Save failed", message, recovery, { code: "CREDIT" });
    } finally {
      setSavingCredit(false);
    }
  };

  const handleToggle = (feature: Feature, checked: boolean) => {
    if (checked) {
      setUserDialogOpen(false);
      setSelectedFeature(feature);
      setModalOpen(true);
    } else {
      updateStoreModule(feature, false);
    }
  };

  const handleConfirm = async () => {
    if (selectedFeature) {
      await updateStoreModule(selectedFeature, true);
    }
    setModalOpen(false);
    setSelectedFeature(null);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setSelectedFeature(null);
  };

  const getFeatureDetails = (feature: Feature | null) => {
    switch (feature) {
      case "campaigns":
        return {
          title: "Opt-In to Campaigns",
          description:
            "Campaigns allow you to create and participate in loyalty and reward programmes.",
        };
      case "marketplace":
        return {
          title: "Opt-In to Marketplace",
          description:
            "The Marketplace feature allows you to place orders from popular third-party online stores on behalf of your customers, earning a service fee for each order.",
        };
      case "boph":
        return {
          title: "Opt-In to BOPH",
          description:
            "BOPH (Buy Online, Pickup Here) lets your store act as a pickup point for online orders. You'll manage incoming parcels and hand them off to customers, earning a fee for the service.",
        };
      case "buyStock":
        return {
          title: "Opt-In to Buy Stock",
          description:
            "Buy Stock lets you order inventory and manage purchase orders for your store.",
        };
      default:
        return { title: "", description: "" };
    }
  };

  const openUserDialog = (user?: User) => {
    setModalOpen(false);
    setSelectedFeature(null);
    if (user) {
      setEditingUser(user);
      userForm.reset({
        name: user.name,
        email: user.email ?? "",
        phone: user.phone ?? "",
      });
    } else {
      setEditingUser(null);
      userForm.reset({ name: "", email: "", phone: "" });
    }
    setUserDialogOpen(true);
  };

  const handleUserSubmit = async (
    values: z.infer<typeof userManagementSchema>
  ) => {
    if (!effectiveOnline) {
      feedback.error(
        "Server unavailable",
        "Staff changes require a working connection to the server. Reconnect and try again.",
        undefined,
        { code: "USER" }
      );
      return;
    }
    const storeId =
      userManagementStoreId ??
      (await ensureStore())?.id ??
      currentUser?.storeId;
    if (!storeId) {
      feedback.error(
        "No store",
        "Cannot add staff without a store. Open the app and ensure a store is loaded.",
        undefined,
        { code: "USER" }
      );
      return;
    }
    try {
      if (editingUser) {
        const updateData = {
          name: values.name,
          email: values.email.trim(),
          phone: values.phone,
        };
        await usersApi.update(editingUser.id!, updateData);
        feedback.success("User updated", "User updated successfully.");
      } else {
        const phone = normalizePhone(values.phone);
        if (phone.length < 10) {
          feedback.error(
            "Invalid number",
            "Please enter at least 10 digits.",
            undefined,
            { code: "USER" }
          );
          return;
        }
        const createData = {
          name: values.name.trim(),
          email: values.email.trim(),
          phone,
          role: "staff",
          storeId,
        };
        await usersApi.create(createData);
        feedback.success(
          "Staff user added",
          "They will receive an SMS to set up their password. They are assigned to this store only."
        );
      }
      setUserDialogOpen(false);
      void fetchUsers();
    } catch (error: any) {
      console.error("Failed to save user:", error);
      if (!editingUser && isDuplicatePhoneError(error)) {
        setUserDialogOpen(false);
        setDuplicatePhonePopupOpen(true);
        return;
      }
      feedback.fromError(
        error,
        "Failed to save user",
        "Check the details and try again, or try again later."
      );
    }
  };

  const closeDuplicatePhonePopup = () => {
    setDuplicatePhonePopupOpen(false);
    setTimeout(() => setUserDialogOpen(true), 0);
  };

  const deleteUser = async (id: string) => {
    if (!effectiveOnline) {
      feedback.error(
        "Server unavailable",
        "Deleting staff requires a working connection to the server.",
        undefined,
        { code: "USER" }
      );
      return;
    }
    try {
      if (id === currentUser?.id) {
        feedback.error(
          "Cannot delete",
          "You cannot delete your own account.",
          "Ask another admin to remove you."
        );
        return;
      }
      await usersApi.remove(id);
      feedback.success("User deleted", "User deleted successfully.");
      void fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      feedback.fromError(
        error,
        "Failed to delete user",
        "Check your connection and try again."
      );
    }
  };

  const openTransferRoleDialog = (user: User) => {
    setTransferTargetUser(user);
    setDeleteCurrentAdminOnTransfer(false);
    setTransferDialogOpen(true);
  };

  const confirmTransferRole = async () => {
    if (!transferTargetUser?.id) return;
    const ok = await refreshEffectiveOnline();
    if (!ok) {
      feedback.error(
        "Server unavailable",
        "Role transfer requires a working connection to the server. Please reconnect and try again."
      );
      return;
    }
    setIsTransferringRole(true);
    try {
      await storesApi.transferStoreRole({
        newStoreAdminId: transferTargetUser.id,
        oldStoreAdminState: deleteCurrentAdminOnTransfer
          ? "deleted"
          : "staff user",
      });
      feedback.success(
        "Role transferred",
        deleteCurrentAdminOnTransfer
          ? "You are signed out. The new store admin should sign in again too. Roles will be correct after sign-in; your account is removed as selected."
          : "You are signed out. The new store admin should sign in again too. Roles will be correct after sign-in—you will be a staff user at this store."
      );
      setTransferDialogOpen(false);
      await logout();
    } catch (error) {
      console.error("Failed to transfer store admin role:", error);
      feedback.fromError(
        error,
        "Failed to transfer role",
        "Please verify the selected user is a staff member and try again."
      );
    } finally {
      setIsTransferringRole(false);
    }
  };

  const openPasswordDialog = (user: User) => {
    setUserForPassword(user);
    passwordForm.reset({ password: "", confirmPassword: "" });
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (
    values: z.infer<typeof passwordSchema>
  ) => {
    if (!userForPassword?.id) return;
    if (!effectiveOnline) {
      feedback.error(
        "Server unavailable",
        "Setting a password requires a working connection to the server.",
        undefined,
        { code: "USER" }
      );
      return;
    }
    try {
      await usersApi.update(userForPassword.id, { password: values.password });
      feedback.success("Password updated", "Password updated successfully.");
      setPasswordDialogOpen(false);
      setUserForPassword(null);
      passwordForm.reset();
    } catch (error: any) {
      console.error("Failed to update password:", error);
      feedback.fromError(
        error,
        "Failed to update password",
        "Ensure the password meets requirements and try again."
      );
    }
  };

  const featureDetails = getFeatureDetails(selectedFeature);

  const handleUpdateApp = async () => {
    if (!effectiveOnline) {
      feedback.error(
        "Server unavailable",
        "Connect to the internet and ensure the server is reachable to update the app.",
        "Connect to Wi‑Fi or mobile data and try again."
      );
      return;
    }

    setIsUpdating(true);
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      try {
        const { getDb } = await import("@/lib/db");
        await getDb().keyVal.delete("REACT_QUERY_OFFLINE_CACHE");
      } catch (e) {
        console.warn("Failed to clear query cache:", e);
      }

      feedback.success(
        "Cache cleared",
        "Reloading the app with the latest version..."
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Failed to update app:", error);
      feedback.fromError(
        error,
        "Failed to update the app",
        "Check your connection and try again."
      );
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Manage your application preferences and features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label
                  htmlFor="theme-toggle"
                  className="font-semibold flex items-center gap-2"
                >
                  {settings.theme === "dark" ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5" />
                  )}
                  Theme
                </Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode.
                </p>
              </div>
              <Switch
                id="theme-toggle"
                checked={settings.theme === "dark"}
                onCheckedChange={(checked) =>
                  setSetting("theme", checked ? "dark" : "light")
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label
                  htmlFor="language-select"
                  className="font-semibold flex items-center gap-2"
                >
                  <Languages className="w-5 h-5" />
                  Language
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred language (coming soon).
                </p>
              </div>
              <Select defaultValue="en" disabled>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="sw">Swahili</SelectItem>
                  <SelectItem value="zu">Zulu</SelectItem>
                  <SelectItem value="so">Somali</SelectItem>
                  <SelectItem value="am">Amharic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label
                  htmlFor="update-app"
                  className="font-semibold flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Update App
                </Label>
                <p className="text-sm text-muted-foreground">
                  Clear cache and reload the app to get the latest version.
                </p>
              </div>
              <Button
                id="update-app"
                onClick={handleUpdateApp}
                disabled={!effectiveOnline || isUpdating}
                variant="outline"
                className="min-h-[44px] touch-target"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    {effectiveOnline ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Update
                      </>
                    ) : (
                      <>
                        <WifiOff className="mr-2 h-4 w-4" />
                        Offline
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label
                  htmlFor="hardware-setup"
                  className="font-semibold flex items-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Hardware setup
                </Label>
                <p className="text-sm text-muted-foreground">
                  Configure receipt printer, barcode scanner, and card reader.
                </p>
              </div>
              <Button
                id="hardware-setup"
                onClick={openHardwareSetup}
                variant="outline"
                className="min-h-[44px] touch-target"
              >
                <Printer className="mr-2 h-4 w-4" />
                Launch hardware setup
              </Button>
            </div>

            <div
              className={cn(
                "space-y-2 pt-4 transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <h3 className="text-lg font-semibold">Feature Management</h3>
              <p className="text-sm text-muted-foreground">
                Enable or disable optional features. Requires internet
                connection.
              </p>
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <div>
                <Label htmlFor="campaigns-toggle" className="font-semibold">
                  Campaigns
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable to create and participate in loyalty and reward
                  programmes.
                </p>
              </div>
              <Switch
                id="campaigns-toggle"
                checked={settings.campaigns}
                onCheckedChange={(checked) =>
                  handleToggle("campaigns", checked)
                }
                disabled={!effectiveOnline || isUpdatingModules}
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <div>
                <Label htmlFor="marketplace-toggle" className="font-semibold">
                  Marketplace
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable ordering from third-party stores.
                </p>
              </div>
              <Switch
                id="marketplace-toggle"
                checked={settings.marketplace}
                onCheckedChange={(checked) =>
                  handleToggle("marketplace", checked)
                }
                disabled={!effectiveOnline || isUpdatingModules}
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <div>
                <Label htmlFor="boph-toggle" className="font-semibold">
                  Buy Online, Pickup Here (BOPH)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable parcel pickup point services.
                </p>
              </div>
              <Switch
                id="boph-toggle"
                checked={settings.boph}
                onCheckedChange={(checked) => handleToggle("boph", checked)}
                disabled={!effectiveOnline || isUpdatingModules}
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <div>
                <Label htmlFor="buy-stock-toggle" className="font-semibold">
                  Buy Stock
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable ordering inventory and managing purchase orders.
                </p>
              </div>
              <Switch
                id="buy-stock-toggle"
                checked={settings.buyStock}
                onCheckedChange={(checked) => handleToggle("buyStock", checked)}
                disabled={!effectiveOnline || isUpdatingModules}
              />
            </div>

            {(isAdmin || currentUser != null) && (
              <>
                <div
                  id="checkout-display-admin"
                  className="space-y-2 pt-4 scroll-mt-4"
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt className="w-5 h-5" /> Checkout display{" "}
                    {isAdmin ? "(Admin)" : ""}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    When ON, VAT is added to the total (Total = Subtotal + VAT).
                    When OFF, VAT is included in the total (no addition).
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="show-vat-toggle" className="font-semibold">
                      Show VAT in checkout summary
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When ON, VAT is added on top (Total = Subtotal + VAT).
                      When OFF, VAT is included in prices and the VAT line is
                      hidden.
                    </p>
                  </div>
                  <Switch
                    id="show-vat-toggle"
                    checked={settings.showVatInCheckout !== false}
                    onCheckedChange={(checked) =>
                      updateShowVatInCheckout(checked)
                    }
                    disabled={!effectiveOnline || isUpdatingModules}
                  />
                </div>

                {(isAdmin || currentUser?.role === "store_admin") && (
                  <>
                    <div
                      id="credit-client"
                      className="space-y-2 pt-4 scroll-mt-4"
                    >
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CreditCard className="w-5 h-5" /> Customer credit
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Allow sales on credit and set the credit limit and
                        payment term. When enabled, the Credit payment option
                        appears at checkout.
                      </p>
                      {!settingsStoreId && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          No store linked. Load a store or use an account with a
                          store so credit settings apply correctly at checkout.
                        </p>
                      )}
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg">
                      {!effectiveOnline && (
                        <p className="text-xs text-muted-foreground">
                          Server unreachable: you can review credit options
                          below. Saving requires a working connection to the
                          server.
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="credit-enabled"
                          className="font-semibold"
                        >
                          Allow sales on credit
                        </Label>
                        <Switch
                          id="credit-enabled"
                          checked={creditForm.enabled}
                          onCheckedChange={(enabled) =>
                            setCreditForm((f) => ({ ...f, enabled }))
                          }
                          disabled={loadingSettings}
                        />
                      </div>
                      {creditForm.enabled && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="credit-limit">
                              Credit limit (e.g. max amount per customer)
                            </Label>
                            <Input
                              id="credit-limit"
                              type="number"
                              min={0}
                              value={creditForm.creditLimit}
                              onChange={(e) =>
                                setCreditForm((f) => ({
                                  ...f,
                                  creditLimit: Number(e.target.value) || 0,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Payment term type</Label>
                            <Select
                              value={creditForm.termType}
                              onValueChange={(v: "fixed" | "variable") =>
                                setCreditForm((f) => ({ ...f, termType: v }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">
                                  Fixed (number of days)
                                </SelectItem>
                                <SelectItem value="variable">
                                  Variable
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {creditForm.termType === "fixed" && (
                            <div className="space-y-2">
                              <Label htmlFor="credit-term">
                                Number of days (payment due)
                              </Label>
                              <Input
                                id="credit-term"
                                type="number"
                                min={0}
                                value={creditForm.term}
                                onChange={(e) =>
                                  setCreditForm((f) => ({
                                    ...f,
                                    term: Number(e.target.value) ?? 7,
                                  }))
                                }
                              />
                            </div>
                          )}
                        </>
                      )}
                      <Button
                        type="button"
                        onClick={() => void saveCreditSettings()}
                        disabled={
                          savingCredit ||
                          !settingsStoreId ||
                          loadingSettings ||
                          !effectiveOnline
                        }
                        className="min-h-[44px] touch-target"
                      >
                        {savingCredit ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save credit settings"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {(isAdmin || currentUser?.role === "store_admin") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users /> User Management
              </CardTitle>
              <CardDescription>
                {userManagementStoreId && settingsStore?.name
                  ? `Staff for this store only: ${settingsStore.name}. Add, edit, or remove staff assigned to this store.`
                  : userManagementStoreId
                    ? "Staff for this store only. Add, edit, or remove staff assigned to this store."
                    : "Load or select a store to manage its staff. Only staff assigned to the current store are shown."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button
                  type="button"
                  disabled={!userManagementStoreId || !effectiveOnline}
                  onClick={(e) => {
                    e.stopPropagation();
                    openUserDialog();
                  }}
                  title={
                    !userManagementStoreId
                      ? "Select or load a store first"
                      : !effectiveOnline
                        ? "Server must be reachable to add or change staff"
                        : "Add staff to this store"
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Staff
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        {effectiveOnline
                          ? "No staff members found. Add one above!"
                          : "No cached staff list for this page. Open Settings while the server is reachable to load staff, then you can view the list offline."}
                      </TableCell>
                    </TableRow>
                  )}
                  {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ||
                            user.storeId === settingsStore?.id ||
                            user.role === "store_admin"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openUserDialog(user)}
                            title="Edit user"
                            disabled={!effectiveOnline}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPasswordDialog(user)}
                            title="Set password"
                            disabled={!effectiveOnline}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {String(user.role ?? "").toLowerCase() ===
                            "staff" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openTransferRoleDialog(user)}
                              title="Transfer store admin role to this staff user"
                              disabled={!effectiveOnline || isTransferringRole}
                            >
                              <Crown className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={
                                  user.id === currentUser?.id ||
                                  !effectiveOnline
                                }
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will
                                  permanently delete the user account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(user.id!)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog
        open={modalOpen && selectedFeature != null}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              {featureDetails.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {featureDetails.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Opt-In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form
              onSubmit={userForm.handleSubmit(handleUserSubmit)}
              className="space-y-4"
            >
              <FormField
                control={userForm.control}
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
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="staff@example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
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
                <Button type="submit" disabled={!effectiveOnline}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      {userForPassword && (
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Password for {userForPassword.name}</DialogTitle>
              <DialogDescription>
                Set a new password for this user. They will be able to use this
                password to log in.
              </DialogDescription>
            </DialogHeader>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder="Enter new password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder="Confirm new password"
                        />
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
                  <Button type="submit" disabled={!effectiveOnline}>
                    Set Password
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Duplicate phone number popup */}
      <AlertDialog
        open={duplicatePhonePopupOpen}
        onOpenChange={setDuplicatePhonePopupOpen}
      >
        <AlertDialogContent
          className="z-[100]"
          aria-describedby="duplicate-phone-description"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Number already registered</AlertDialogTitle>
            <AlertDialogDescription id="duplicate-phone-description">
              This phone number is already registered for a staff member. Please
              use a different number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeDuplicatePhonePopup}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={transferDialogOpen}
        onOpenChange={(open) =>
          !isTransferringRole && setTransferDialogOpen(open)
        }
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Store Admin transfer</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  You are transferring Store Admin to{" "}
                  <span className="font-semibold text-foreground">
                    {transferTargetUser?.name ?? "this user"}
                  </span>
                  . Please confirm below. This action cannot be undone.
                </p>
                <p>
                  After you confirm, this app signs you out and the new store
                  admin should be signed out as well (existing sessions may stay
                  valid until the server ends them or they expire). When both of
                  you sign in again, roles will match the server—the previous
                  store admin is deleted only if you select that option in the
                  checkbox.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <p>New Store Admin: {transferTargetUser?.name ?? "-"}</p>
              <p>Phone: {transferTargetUser?.phone ?? "-"}</p>
              <p>Current Store Admin: {currentUser?.name ?? "Current user"}</p>
            </div>

            <p className="text-sm font-medium text-foreground">
              What should happen to the current Store Admin account (you)?
            </p>
            <div className="flex items-start space-x-2 rounded-md border p-3">
              <Checkbox
                id="delete-current-admin-on-transfer"
                checked={deleteCurrentAdminOnTransfer}
                onCheckedChange={(checked) =>
                  setDeleteCurrentAdminOnTransfer(checked === true)
                }
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="delete-current-admin-on-transfer"
                  className="cursor-pointer font-normal"
                >
                  Delete the current Store Admin
                </Label>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Unchecked:
                  </span>{" "}
                  keep the account and make them a staff user at this store.{" "}
                  <span className="font-medium text-foreground">Checked:</span>{" "}
                  remove or deactivate the current Store Admin per server rules.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={isTransferringRole}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void confirmTransferRole()}
              disabled={isTransferringRole || !effectiveOnline}
            >
              {isTransferringRole && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
