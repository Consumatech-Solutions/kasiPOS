"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppSettings, User, Store } from "@/types";
import { authApi } from "@/lib/api/auth";
import { isNetworkErrorLike } from "@/lib/network-error";

interface SettingsContextType {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  isPwa: boolean;
  logout: () => Promise<void>;
  login: (user: User & { accessToken?: string }) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

const defaultSettings: AppSettings = {
  theme: "light",
  language: "en",
  campaigns: false,
  marketplace: false,
  boph: false,
  buyStock: true,
  showVatInCheckout: true,
  isLoggedIn: false,
  currentUser: null,
  currentStore: null,
};

function readPersistedSettings(): AppSettings {
  try {
    const item = window.localStorage.getItem("kasi-pos-settings");
    const storedSettings = item ? JSON.parse(item) : {};
    const itemUser = window.localStorage.getItem("user");
    const token = window.localStorage.getItem("token");
    const hasToken = typeof token === "string" && token.trim() !== "";
    const persistedUser = itemUser ? JSON.parse(itemUser) : null;
    const currentUser = hasToken ? persistedUser : null;

    const currentStore = hasToken ? storedSettings.currentStore || null : null;
    const modules = currentStore?.enabledModules;
    return {
      ...defaultSettings,
      theme: storedSettings.theme || "light",
      currentUser,
      currentStore,
      isLoggedIn: Boolean(currentUser && hasToken),
      campaigns: modules?.campaigns ?? defaultSettings.campaigns,
      marketplace: modules?.marketplace ?? defaultSettings.marketplace,
      boph: modules?.boph ?? defaultSettings.boph,
      buyStock: modules?.buyStock ?? defaultSettings.buyStock,
      showVatInCheckout:
        modules?.showVatInCheckout ??
        (typeof storedSettings.showVatInCheckout === "boolean"
          ? storedSettings.showVatInCheckout
          : defaultSettings.showVatInCheckout),
    };
  } catch (error) {
    console.error("Error reading settings from localStorage", error);
    return defaultSettings;
  }
}

function persistedSettingsMatch(a: AppSettings, b: AppSettings): boolean {
  return (
    a.theme === b.theme &&
    a.language === b.language &&
    a.isLoggedIn === b.isLoggedIn &&
    (a.currentUser as { id?: string } | null)?.id ===
      (b.currentUser as { id?: string } | null)?.id &&
    (a.currentStore as { id?: string } | null)?.id ===
      (b.currentStore as { id?: string } | null)?.id &&
    a.campaigns === b.campaigns &&
    a.marketplace === b.marketplace &&
    a.boph === b.boph &&
    a.buyStock === b.buyStock &&
    a.showVatInCheckout === b.showVatInCheckout
  );
}

const AUTH_ROUTES = [
  "/login",
  "/request-access",
  "/verify-code",
  "/set-password",
  "/set-password-store-admin",
];
const SETUP_ROUTE = "/store-setup";

function isCypressRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as Window & { Cypress?: unknown }).Cypress)
  );
}

function isKasiPosE2eRuntime(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("__kasi_pos_e2e") === "1" ||
      window.sessionStorage.getItem("__kasi_pos_e2e") === "1"
    );
  } catch {
    return false;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isPwa, setIsPwa] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const setSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const inPwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsPwa(inPwa);

    const restored = readPersistedSettings();
    setSettings((prev) => {
      if (persistedSettingsMatch(prev, restored)) return prev;
      return { ...prev, ...restored };
    });
    setHasHydratedStorage(true);
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    const store = settings.currentStore;
    const modules = store?.enabledModules;
    if (!modules) return;
    setSettings((prev) => {
      if (prev.currentStore?.id !== store?.id) return prev;
      const campaigns = modules.campaigns ?? prev.campaigns;
      const marketplace = modules.marketplace ?? prev.marketplace;
      const boph = modules.boph ?? prev.boph;
      const buyStock = modules.buyStock ?? prev.buyStock;
      const showVatInCheckout =
        modules?.showVatInCheckout ?? prev.showVatInCheckout;
      if (
        prev.campaigns === campaigns &&
        prev.marketplace === marketplace &&
        prev.boph === boph &&
        prev.buyStock === buyStock &&
        prev.showVatInCheckout === showVatInCheckout
      )
        return prev;
      return {
        ...prev,
        campaigns,
        marketplace,
        boph,
        buyStock,
        showVatInCheckout,
      };
    });
  }, [settings.currentStore?.id, settings.currentStore?.enabledModules]);

  const creditFetchedForStoreIdRef = useRef<string | null>(null);
  useEffect(() => {
    const store = settings.currentStore;
    const storeId = store?.id;
    if (!storeId || !store) return;
    if (creditFetchedForStoreIdRef.current === storeId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    creditFetchedForStoreIdRef.current = storeId;
    (async () => {
      try {
        const { settingsApi } = await import("@/lib/api/settings");
        const res = await settingsApi.get(storeId);
        const raw = res.data as {
          credit?: Store["credit"];
          data?: { credit?: Store["credit"] };
        };
        const credit = raw?.data?.credit ?? raw?.credit;
        if (credit !== undefined) {
          const storeWithCredit = { ...store, credit };
          setSetting("currentStore", storeWithCredit);
          const { saveStorePermanently } =
            await import("@/lib/store-persistence");
          await saveStorePermanently(storeWithCredit, setSetting);
        }
      } catch (_) {
        creditFetchedForStoreIdRef.current = null;
      }
    })();
  }, [settings.currentStore, setSetting]);

  useEffect(() => {
    const loadStoreFromIndexedDB = async () => {
      if (settings.currentStore || !settings.currentUser) {
        return;
      }

      try {
        const { loadStoreFromIndexedDB: loadStore } =
          await import("@/lib/store-persistence");
        const cachedStore = await loadStore(settings.currentUser.storeId);
        if (cachedStore) {
          setSetting("currentStore", cachedStore);
        }
      } catch (error) {
        console.warn(
          "[SettingsProvider] Failed to load store from IndexedDB:",
          error
        );
      }
    };

    if (isInitialLoad && settings.currentUser && !settings.currentStore) {
      loadStoreFromIndexedDB();
    }
  }, [isInitialLoad, settings.currentUser, settings.currentStore, setSetting]);

  const logout = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Are you sure you want to log out? Offline data on this device will be kept."
      )
    ) {
      return;
    }

    const theme = settings.theme;

    const newSettings = {
      ...defaultSettings,
      theme,
      isLoggedIn: false,
      currentUser: null,
      currentStore: null,
    };
    try {
      window.localStorage.setItem(
        "kasi-pos-settings",
        JSON.stringify({ theme })
      );
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
      window.localStorage.removeItem("__kasi_pos_e2e");
      window.sessionStorage.removeItem("__kasi_pos_e2e");
    } catch (error) {
      console.error("Error saving settings to localStorage on logout", error);
    }
    setSettings(newSettings);
    router.replace("/login");

    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout API call failed", error);
    }
  }, [router, settings.theme]);

  useEffect(() => {
    const bootstrapData = async () => {
      if (settings.currentUser) {
        const isCypress =
          typeof window !== "undefined" &&
          Boolean((window as Window & { Cypress?: unknown }).Cypress);
        if (isCypress) {
          if (!settings.currentStore) {
            try {
              const { loadStoreFromIndexedDB } =
                await import("@/lib/store-persistence");
              const cachedStore = await loadStoreFromIndexedDB(
                settings.currentUser.storeId
              );
              if (cachedStore) setSetting("currentStore", cachedStore);
            } catch {
              // Ignore IndexedDB lookup failures in Cypress bootstrap mode.
            }
          }
          return;
        }
        try {
          let freshUser = settings.currentUser;
          try {
            const userResponse = await authApi.getProfile();
            freshUser = userResponse.data;
            setSetting("currentUser", freshUser);
            localStorage.setItem("user", JSON.stringify(freshUser));
          } catch (profileErr: any) {
            if (profileErr?.response?.status === 401) {
              await logout();
              return;
            }
            if (isNetworkErrorLike(profileErr)) {
              if (
                process.env.NODE_ENV === "development" &&
                !(window as any).__bootstrapNetworkWarned
              ) {
                (window as any).__bootstrapNetworkWarned = true;
                console.warn(
                  "[SettingsProvider] Backend not reachable. Using cached user and store."
                );
              }
            } else {
              throw profileErr;
            }
          }

          if (freshUser?.storeId) {
            try {
              const { fetchAndSaveStore } =
                await import("@/lib/store-persistence");
              const store = await fetchAndSaveStore(
                setSetting,
                freshUser?.storeId ?? null
              );
              if (store) {
                setSetting("currentStore", store);
              }
            } catch (error: any) {
              if (isNetworkErrorLike(error)) {
                const { loadStoreFromIndexedDB } =
                  await import("@/lib/store-persistence");
                const cachedStore = await loadStoreFromIndexedDB(
                  freshUser!.storeId
                );
                if (cachedStore) setSetting("currentStore", cachedStore);
              } else if (process.env.NODE_ENV === "development") {
                console.warn("Failed to fetch store:", error);
              }
            }
          } else if (!settings.currentStore) {
            try {
              const { fetchAndSaveStore } =
                await import("@/lib/store-persistence");
              const store = await fetchAndSaveStore(
                setSetting,
                freshUser?.storeId ?? null
              );
              if (store) setSetting("currentStore", store);
            } catch (e) {
              if (isNetworkErrorLike(e)) {
                const { loadStoreFromIndexedDB } =
                  await import("@/lib/store-persistence");
                const cachedStore = await loadStoreFromIndexedDB();
                if (cachedStore) setSetting("currentStore", cachedStore);
              }
            }
          } else if (!settings.currentStore) {
            const { loadStoreFromIndexedDB } =
              await import("@/lib/store-persistence");
            const cachedStore = await loadStoreFromIndexedDB();
            if (cachedStore) setSetting("currentStore", cachedStore);
          }

          if (settings.currentStore?.id) {
            try {
              const { getDb } = await import("@/lib/db");
              const db = getDb();
              const existingCount = await db.transactions.count();
              if (existingCount === 0) {
                const { transactionsApi } =
                  await import("@/lib/api/transactions");
                let allTransactions: import("@/types").Transaction[] = [];
                let page = 1;
                const limit = 100;
                while (allTransactions.length < 10000) {
                  const res = await transactionsApi.getAll({
                    storeId: settings.currentStore!.id,
                    limit,
                    page,
                  });
                  const raw = res.data;
                  const data = Array.isArray(raw)
                    ? raw
                    : "data" in raw
                      ? raw.data
                      : [];
                  if (!data.length) break;
                  allTransactions = allTransactions.concat(data);
                  if (data.length < limit) break;
                  page++;
                }
                if (allTransactions.length > 0) {
                  await db.transactions.bulkPut(
                    allTransactions.map((t) => ({
                      ...t,
                      id: t.id ?? `server-${Date.now()}-${Math.random()}`,
                    }))
                  );
                }
              }
            } catch (err) {
              if (process.env.NODE_ENV === "development") {
                console.warn("Failed to bootstrap transactions:", err);
              }
            }
          }
        } catch (error: any) {
          if (
            !isNetworkErrorLike(error) &&
            process.env.NODE_ENV === "development"
          ) {
            console.error("Failed to bootstrap app data:", error);
          }
        }
      }
    };
    if (isInitialLoad) {
      bootstrapData();
    }
  }, [isInitialLoad, setSetting, logout, settings.currentUser]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(settings.theme);
    try {
      let existing: Record<string, unknown> = {};
      try {
        const raw = window.localStorage.getItem("kasi-pos-settings");
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            existing = parsed as Record<string, unknown>;
          }
        }
      } catch {
        existing = {};
      }
      const next: Record<string, unknown> = {
        ...existing,
        theme: settings.theme,
        showVatInCheckout: settings.showVatInCheckout,
      };
      if (settings.currentStore) {
        next.currentStore = settings.currentStore;
      } else if (!settings.isLoggedIn || !settings.currentUser) {
        delete next.currentStore;
      }
      window.localStorage.setItem("kasi-pos-settings", JSON.stringify(next));
      if (settings.currentUser) {
        window.localStorage.setItem(
          "user",
          JSON.stringify(settings.currentUser)
        );
      } else {
        const existingUser = window.localStorage.getItem("user");
        if (!existingUser) {
          window.localStorage.removeItem("user");
        }
      }
    } catch (error) {
      console.error("Error saving settings to localStorage", error);
    }
  }, [settings, hasHydratedStorage]);

  useEffect(() => {
    if (isInitialLoad || !hasHydratedStorage) return;

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isSetupRoute = pathname === SETUP_ROUTE;
    const hasPersistedSession =
      typeof window !== "undefined" &&
      Boolean(window.localStorage.getItem("user")) &&
      Boolean(window.localStorage.getItem("token"));

    const isCypress = isCypressRuntime();
    const isE2eHarness = isKasiPosE2eRuntime();

    if (!settings.isLoggedIn && !isAuthRoute) {
      if (hasPersistedSession) {
        return;
      }
      if (isCypress || isE2eHarness) {
        return;
      }
      if (pathname.startsWith("/marketplace") || pathname.startsWith("/boph")) {
        return;
      }
      router.push("/login");
    } else if (settings.isLoggedIn) {
      if (isAuthRoute) {
        router.push("/");
        return;
      }

      if (settings.currentStore) {
        if (!settings.currentStore.isSetupComplete && !isSetupRoute) {
          router.push(SETUP_ROUTE);
        } else if (settings.currentStore.isSetupComplete && isSetupRoute) {
          router.push("/");
        }

        if (
          settings.currentUser?.role === "staff" &&
          pathname.startsWith("/settings")
        ) {
          router.push("/");
        }
      }
    }
  }, [
    settings.isLoggedIn,
    settings.currentStore,
    settings.currentUser,
    pathname,
    router,
    isInitialLoad,
    hasHydratedStorage,
  ]);

  const login = useCallback(
    async (userData: User & { accessToken?: string }) => {
      if (userData.accessToken) {
        localStorage.setItem("token", userData.accessToken);
      }

      localStorage.setItem("user", JSON.stringify(userData));

      setSettings((prev) => ({
        ...prev,
        currentUser: userData,
        isLoggedIn: true,
      }));

      try {
        const { fetchAndSaveStore } = await import("@/lib/store-persistence");
        const store = await fetchAndSaveStore(
          setSetting,
          userData?.storeId ?? null
        );
        if (store) {
          setSetting("currentStore", store);
        } else {
          const { loadStoreFromIndexedDB } =
            await import("@/lib/store-persistence");
          const cachedStore = await loadStoreFromIndexedDB(userData.storeId);
          if (cachedStore) {
            setSetting("currentStore", cachedStore);
          }
        }
      } catch (error: any) {
        if (isNetworkErrorLike(error)) {
          console.log(
            "[SettingsProvider] Network error during login - loading store from IndexedDB"
          );
          const { loadStoreFromIndexedDB } =
            await import("@/lib/store-persistence");
          const cachedStore = await loadStoreFromIndexedDB(userData.storeId);
          if (cachedStore) {
            setSetting("currentStore", cachedStore);
          }
        } else {
          console.warn(
            "[SettingsProvider] Failed to fetch store after login:",
            error
          );
        }
      }
    },
    [setSetting]
  );

  const canRenderChildren = () => {
    if (!hasHydratedStorage) return false;
    if (!settings.isLoggedIn) {
      const hasPersistedSession =
        typeof window !== "undefined" &&
        Boolean(window.localStorage.getItem("user")) &&
        Boolean(window.localStorage.getItem("token"));
      const hasSeededToken =
        typeof window !== "undefined" &&
        Boolean(window.localStorage.getItem("token"));
      const allowHarnessShell = isKasiPosE2eRuntime() && hasSeededToken;
      const allowMarketplaceBootstrap =
        pathname.startsWith("/marketplace") && hasSeededToken;
      const allowBophBootstrap = pathname.startsWith("/boph") && hasSeededToken;
      if (
        hasPersistedSession ||
        allowHarnessShell ||
        allowMarketplaceBootstrap ||
        allowBophBootstrap
      ) {
        return !AUTH_ROUTES.includes(pathname) && pathname !== SETUP_ROUTE;
      }
      return AUTH_ROUTES.includes(pathname);
    }
    if (settings.currentStore && !settings.currentStore.isSetupComplete)
      return pathname === SETUP_ROUTE;
    return !AUTH_ROUTES.includes(pathname) && pathname !== SETUP_ROUTE;
  };

  const value = { settings, setSetting, isPwa, logout, login };

  return (
    <SettingsContext.Provider value={value}>
      {canRenderChildren() ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
