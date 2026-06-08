"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { AppSettings, User } from "@/types";
import { useTranslation } from "react-i18next";
import { normalizeToSupportedI18nLng } from "@/lib/language-code";

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
import { feedback } from "@/lib/feedback";
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
  const { t } = useTranslation();
  const staffRoleLabel = (role: string | undefined) => {
    const norm = String(role ?? "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (norm === "admin" || norm === "store_admin" || norm === "staff") {
      return t(`settings.staff.role.${norm}`);
    }
    return role ?? "";
  };
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
      .get(settingsStoreId)
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
    settingsStoreId,
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
        t("settings.storeUpdate.failedTitle"),
        err?.message ?? t("settings.storeUpdate.failedFeatureBody")
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
        t("settings.storeUpdate.failedTitle"),
        err?.message ?? t("settings.storeUpdate.failedVatBody")
      );
      setSetting("showVatInCheckout", !checked);
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const saveCreditSettings = async () => {
    if (!settingsStoreId) {
      feedback.error(
        t("settings.credit.feedback.noStoreTitle"),
        t("settings.credit.feedback.noStoreDesc"),
        undefined,
        { code: "CREDIT" }
      );
      return;
    }
    if (!settingsStore) {
      feedback.error(
        t("settings.credit.feedback.noStoreTitle"),
        t("settings.credit.feedback.noStoreContextDesc"),
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
        t("settings.credit.feedback.serverUnavailableTitle"),
        t("settings.credit.feedback.serverUnavailableDesc"),
        undefined,
        { code: "CREDIT" }
      );
      return;
    }

    setSavingCredit(true);
    try {
      await settingsApi.patch(body, settingsStoreId);
      let updatedCredit: typeof settingsStore.credit = null;
      if (creditForm.enabled) {
        try {
          const verifyRes = await settingsApi.get(settingsStoreId);
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
          t("settings.credit.feedback.savedNotConfirmedTitle"),
          t("settings.credit.feedback.savedNotConfirmedDesc"),
          t("settings.credit.feedback.savedNotConfirmedHint"),
          { code: "CREDIT" }
        );
      } else {
        feedback.success(
          t("settings.credit.feedback.savedTitle"),
          t("settings.credit.feedback.savedDesc")
        );
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string | string[] }; status?: number };
        message?: string;
      };
      let message: string = (err as Error)?.message ?? "Failed to save.";
      if (ax?.response?.data) {
        const msg = ax.response.data.message;
        if (typeof msg === "string") message = msg;
        else if (Array.isArray(msg) && msg[0]) message = String(msg[0]);
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[Credit settings] PATCH /settings failed", {
          status: ax?.response?.status,
          data: ax?.response?.data,
          err,
        });
      }
      feedback.error(
        t("settings.credit.feedback.saveFailedTitle"),
        message,
        undefined,
        { code: "CREDIT" }
      );
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
          title: t("settings.featureOptIn.campaigns.title"),
          description: t("settings.featureOptIn.campaigns.description"),
        };
      case "marketplace":
        return {
          title: t("settings.featureOptIn.marketplace.title"),
          description: t("settings.featureOptIn.marketplace.description"),
        };
      case "boph":
        return {
          title: t("settings.featureOptIn.boph.title"),
          description: t("settings.featureOptIn.boph.description"),
        };
      case "buyStock":
        return {
          title: t("settings.featureOptIn.buyStock.title"),
          description: t("settings.featureOptIn.buyStock.description"),
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
        t("settings.staff.feedback.staffServerUnavailableTitle"),
        t("settings.staff.feedback.staffServerUnavailableDesc"),
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
        t("settings.staff.feedback.noStoreCannotAddTitle"),
        t("settings.staff.feedback.noStoreCannotAddDesc"),
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
        feedback.success(
          t("settings.staff.feedback.userUpdatedTitle"),
          t("settings.staff.feedback.userUpdatedDesc")
        );
      } else {
        const phone = normalizePhone(values.phone);
        if (phone.length < 10) {
          feedback.error(
            t("settings.staff.feedback.invalidPhoneTitle"),
            t("settings.staff.feedback.invalidPhoneDesc"),
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
          t("settings.staff.feedback.staffAddedTitle"),
          t("settings.staff.feedback.staffAddedDesc")
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
        t("settings.staff.feedback.saveUserFailedTitle"),
        t("settings.staff.feedback.saveUserFailedHint")
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
        t("settings.staff.feedback.deleteServerUnavailableTitle"),
        t("settings.staff.feedback.deleteServerUnavailableDesc"),
        undefined,
        { code: "USER" }
      );
      return;
    }
    try {
      if (id === currentUser?.id) {
        feedback.error(
          t("settings.staff.feedback.cannotDeleteSelfTitle"),
          t("settings.staff.feedback.cannotDeleteSelfDesc"),
          t("settings.staff.feedback.cannotDeleteSelfHint")
        );
        return;
      }
      await usersApi.remove(id);
      feedback.success(
        t("settings.staff.feedback.userDeletedTitle"),
        t("settings.staff.feedback.userDeletedDesc")
      );
      void fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      feedback.fromError(
        error,
        t("settings.staff.feedback.deleteUserFailedTitle"),
        t("settings.staff.feedback.deleteUserFailedHint")
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
        t("settings.staff.feedback.transferServerUnavailableTitle"),
        t("settings.staff.feedback.transferServerUnavailableDesc")
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
        t("settings.staff.feedback.roleTransferredTitle"),
        deleteCurrentAdminOnTransfer
          ? t("settings.staff.feedback.roleTransferredDeletedDesc")
          : t("settings.staff.feedback.roleTransferredStaffDesc")
      );
      setTransferDialogOpen(false);
      await logout();
    } catch (error) {
      console.error("Failed to transfer store admin role:", error);
      feedback.fromError(
        error,
        t("settings.staff.feedback.transferFailedTitle"),
        t("settings.staff.feedback.transferFailedHint")
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
        t("settings.staff.feedback.passwordServerUnavailableTitle"),
        t("settings.staff.feedback.passwordServerUnavailableDesc"),
        undefined,
        { code: "USER" }
      );
      return;
    }
    try {
      await usersApi.update(userForPassword.id, { password: values.password });
      feedback.success(
        t("settings.staff.feedback.passwordUpdatedTitle"),
        t("settings.staff.feedback.passwordUpdatedDesc")
      );
      setPasswordDialogOpen(false);
      setUserForPassword(null);
      passwordForm.reset();
    } catch (error: any) {
      console.error("Failed to update password:", error);
      feedback.fromError(
        error,
        t("settings.staff.feedback.passwordUpdateFailedTitle"),
        t("settings.staff.feedback.passwordUpdateFailedHint")
      );
    }
  };

  const featureDetails = getFeatureDetails(selectedFeature);

  const handleUpdateApp = async () => {
    if (!effectiveOnline) {
      feedback.error(
        t("settings.updateApp.feedback.serverUnavailableTitle"),
        t("settings.updateApp.feedback.serverUnavailableDesc"),
        t("settings.updateApp.feedback.serverUnavailableHint")
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
        t("settings.updateApp.feedback.cacheClearedTitle"),
        t("settings.updateApp.feedback.cacheClearedDesc")
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Failed to update app:", error);
      feedback.fromError(
        error,
        t("settings.updateApp.feedback.failedTitle"),
        t("settings.updateApp.feedback.failedHint")
      );
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.page.title")}</CardTitle>
            <CardDescription>{t("settings.page.description")}</CardDescription>
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
                  {t("settings.theme.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.theme.description")}
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
                  {t("settings.language.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.language.description")}
                </p>
              </div>
              <Select
                value={normalizeToSupportedI18nLng(settings.language)}
                onValueChange={(value) => {
                  if (value === "en" || value === "fr") {
                    setSetting("language", value as AppSettings["language"]);
                  }
                }}
              >
                <SelectTrigger
                  id="language-select"
                  className="w-[180px]"
                  aria-label={t("settings.language.label")}
                >
                  <SelectValue
                    placeholder={t("settings.language.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    {t("settings.language.english")}
                  </SelectItem>
                  <SelectItem value="fr">
                    {t("settings.language.french")}
                  </SelectItem>
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
                  {t("settings.updateApp.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.updateApp.description")}
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
                    {t("settings.updateApp.button.updating")}
                  </>
                ) : (
                  <>
                    {effectiveOnline ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("settings.updateApp.button.update")}
                      </>
                    ) : (
                      <>
                        <WifiOff className="mr-2 h-4 w-4" />
                        {t("settings.updateApp.button.offline")}
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
                  {t("settings.hardware.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.hardware.description")}
                </p>
              </div>
              <Button
                id="hardware-setup"
                onClick={openHardwareSetup}
                variant="outline"
                className="min-h-[44px] touch-target"
              >
                <Printer className="mr-2 h-4 w-4" />
                {t("settings.hardware.launch")}
              </Button>
            </div>

            <div
              className={cn(
                "space-y-2 pt-4 transition-opacity",
                !effectiveOnline && "opacity-60 pointer-events-none"
              )}
            >
              <h3 className="text-lg font-semibold">
                {t("settings.features.sectionTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.features.sectionDescription")}
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
                  {t("settings.features.campaigns.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.features.campaigns.description")}
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
                  {t("settings.features.marketplace.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.features.marketplace.description")}
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
                  {t("settings.features.boph.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.features.boph.description")}
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
                  {t("settings.features.buyStock.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.features.buyStock.description")}
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
                    <Receipt className="w-5 h-5" />{" "}
                    {isAdmin
                      ? t("settings.checkout.titleAdmin")
                      : t("settings.checkout.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.checkout.intro")}
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="show-vat-toggle" className="font-semibold">
                      {t("settings.checkout.showVat.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.checkout.showVat.description")}
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
                        <CreditCard className="w-5 h-5" />{" "}
                        {t("settings.credit.title")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.credit.intro")}
                      </p>
                      {!settingsStoreId && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          {t("settings.credit.noStoreWarning")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg">
                      {!effectiveOnline && (
                        <p className="text-xs text-muted-foreground">
                          {t("settings.credit.offlineNote")}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="credit-enabled"
                          className="font-semibold"
                        >
                          {t("settings.credit.allow.label")}
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
                              {t("settings.credit.limit.label")}
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
                            <Label>{t("settings.credit.termType.label")}</Label>
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
                                  {t("settings.credit.termType.fixed")}
                                </SelectItem>
                                <SelectItem value="variable">
                                  {t("settings.credit.termType.variable")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {creditForm.termType === "fixed" && (
                            <div className="space-y-2">
                              <Label htmlFor="credit-term">
                                {t("settings.credit.termDays.label")}
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
                            {t("settings.credit.saving")}
                          </>
                        ) : (
                          t("settings.credit.save")
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
                <Users /> {t("settings.staff.title")}
              </CardTitle>
              <CardDescription>
                {userManagementStoreId && settingsStore?.name
                  ? t("settings.staff.descriptionWithStore", {
                      storeName: settingsStore.name,
                    })
                  : userManagementStoreId
                    ? t("settings.staff.descriptionStoreOnly")
                    : t("settings.staff.descriptionNoStore")}
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
                      ? t("settings.staff.addTitleNoStore")
                      : !effectiveOnline
                        ? t("settings.staff.addTitleOffline")
                        : t("settings.staff.addTitleOnline")
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" />{" "}
                  {t("settings.staff.addButton")}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.staff.table.name")}</TableHead>
                    <TableHead>{t("settings.staff.table.phone")}</TableHead>
                    <TableHead>{t("settings.staff.table.role")}</TableHead>
                    <TableHead className="text-right">
                      {t("settings.staff.table.actions")}
                    </TableHead>
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
                          ? t("settings.staff.empty.online")
                          : t("settings.staff.empty.offline")}
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
                          {staffRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openUserDialog(user)}
                            title={t("settings.staff.action.editTitle")}
                            disabled={!effectiveOnline}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPasswordDialog(user)}
                            title={t("settings.staff.action.setPasswordTitle")}
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
                              title={t("settings.staff.action.transferTitle")}
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
                                title={t("settings.staff.action.deleteTitle")}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("settings.staff.delete.title")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("settings.staff.delete.description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("settings.staff.delete.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(user.id!)}
                                >
                                  {t("settings.staff.delete.confirm")}
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
                  {t("settings.staff.pagination.previous")}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {t("settings.staff.pagination.pageOf", {
                    page,
                    total: totalPages,
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t("settings.staff.pagination.next")}
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
            <AlertDialogCancel onClick={handleCancel}>
              {t("settings.featureOptIn.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {t("settings.featureOptIn.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? t("settings.staff.dialog.editTitle")
                : t("settings.staff.dialog.addTitle")}
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
                    <FormLabel>{t("settings.staff.form.fullName")}</FormLabel>
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
                    <FormLabel>{t("settings.staff.form.email")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={t("settings.staff.form.emailPlaceholder")}
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
                    <FormLabel>{t("settings.staff.form.mobile")}</FormLabel>
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
                    {t("settings.staff.dialog.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={!effectiveOnline}>
                  {t("settings.staff.dialog.save")}
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
              <DialogTitle>
                {t("settings.staff.password.title", {
                  name: userForPassword.name,
                })}
              </DialogTitle>
              <DialogDescription>
                {t("settings.staff.password.description")}
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
                      <FormLabel>
                        {t("settings.staff.password.newLabel")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder={t(
                            "settings.staff.password.newPlaceholder"
                          )}
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
                      <FormLabel>
                        {t("settings.staff.password.confirmLabel")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder={t(
                            "settings.staff.password.confirmPlaceholder"
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      {t("settings.staff.password.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={!effectiveOnline}>
                    {t("settings.staff.password.submit")}
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
            <AlertDialogTitle>
              {t("settings.staff.duplicatePhone.title")}
            </AlertDialogTitle>
            <AlertDialogDescription id="duplicate-phone-description">
              {t("settings.staff.duplicatePhone.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeDuplicatePhonePopup}>
              {t("settings.staff.duplicatePhone.ok")}
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
            <DialogTitle>{t("settings.staff.transfer.title")}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t("settings.staff.transfer.lead", {
                    name:
                      transferTargetUser?.name ??
                      t("settings.staff.transfer.targetFallback"),
                  })}
                </p>
                <p>{t("settings.staff.transfer.details")}</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <p>
                {t("settings.staff.transfer.summaryNewAdmin", {
                  name: transferTargetUser?.name ?? "-",
                })}
              </p>
              <p>
                {t("settings.staff.transfer.summaryPhone", {
                  phone: transferTargetUser?.phone ?? "-",
                })}
              </p>
              <p>
                {t("settings.staff.transfer.summaryCurrentAdmin", {
                  name:
                    currentUser?.name ??
                    t("settings.staff.transfer.currentUserFallback"),
                })}
              </p>
            </div>

            <p className="text-sm font-medium text-foreground">
              {t("settings.staff.transfer.accountQuestion")}
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
                  {t("settings.staff.transfer.deleteCheckbox")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("settings.staff.transfer.uncheckedLabel")}
                  </span>{" "}
                  {t("settings.staff.transfer.uncheckedHint")}{" "}
                  <span className="font-medium text-foreground">
                    {t("settings.staff.transfer.checkedLabel")}
                  </span>{" "}
                  {t("settings.staff.transfer.checkedHint")}
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
                {t("settings.staff.transfer.cancel")}
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
              {t("settings.staff.transfer.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
