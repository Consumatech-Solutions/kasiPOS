
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppSettings, User, Store } from '@/types';
import { storesApi } from '@/lib/api/stores';
import { authApi } from '@/lib/api/auth';


interface SettingsContextType {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isPwa: boolean;
  logout: () => void;
  login: (user: User & { accessToken?: string }) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  theme: 'light',
  language: 'en',
  campaigns: true,
  marketplace: true,
  boph: true,
  showVatInCheckout: true,
  isLoggedIn: false,
  currentUser: null,
  currentStore: null,
};

function getInitialSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  try {
    const item = window.localStorage.getItem('kasi-pos-settings');
    const storedSettings = item ? JSON.parse(item) : {};
    // Only persist currentUser from localStorage on initial load
    const itemUser = window.localStorage.getItem('user');
    const currentUser = itemUser ? JSON.parse(itemUser) : null;
    
    // We only keep theme from settings and currentUser from its own key
    // Store will be loaded from IndexedDB in useEffect if not in localStorage
    return { 
        ...defaultSettings, 
        theme: storedSettings.theme || 'light', 
        showVatInCheckout: storedSettings.showVatInCheckout !== false,
        currentUser,
        currentStore: storedSettings.currentStore || null,
        isLoggedIn: !!currentUser
    };
  } catch (error) {
    console.error('Error reading settings from localStorage', error);
    return defaultSettings;
  }
}

const AUTH_ROUTES = ['/login', '/request-access', '/verify-code', '/set-password', '/set-password-store-admin'];
const SETUP_ROUTE = '/store-setup';


export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [isPwa, setIsPwa] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  
  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Load store from IndexedDB on initial load if not in localStorage
  useEffect(() => {
    const loadStoreFromIndexedDB = async () => {
      if (settings.currentStore || !settings.currentUser) {
        return; // Already have store or no user
      }

      try {
        const { loadStoreFromIndexedDB: loadStore } = await import('@/lib/store-persistence');
        const cachedStore = await loadStore(settings.currentUser.storeId);
        if (cachedStore) {
          console.log('[SettingsProvider] Restored store from IndexedDB on initial load');
          setSetting('currentStore', cachedStore);
        }
      } catch (error) {
        console.warn('[SettingsProvider] Failed to load store from IndexedDB:', error);
      }
    };

    if (isInitialLoad && settings.currentUser && !settings.currentStore) {
      loadStoreFromIndexedDB();
    }
  }, [isInitialLoad, settings.currentUser, settings.currentStore, setSetting]);

  const logout = useCallback(async () => {
    const theme = settings.theme; // Preserve theme across logout
    
    try {
        await authApi.logout();
    } catch (error) {
        // Ignore API errors during logout, we want to clear local state anyway
        console.error('Logout API call failed', error);
    }

    // Create a new settings object for logout state
    const newSettings = {
        ...defaultSettings,
        theme, // keep the theme
        isLoggedIn: false,
        currentUser: null,
        currentStore: null,
    };
    try {
        // Persist only the parts we want to keep after logout
        window.localStorage.setItem('kasi-pos-settings', JSON.stringify({ theme }));
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user'); // Explicitly remove user
    } catch (error) {
        console.error('Error saving settings to localStorage on logout', error);
    }
    setSettings(newSettings); 
    router.push('/login');
  }, [router, settings.theme]);



// ...

  // Helper: treat as network/offline error (from API core or axios)
  const isNetworkError = (err: any) =>
    err?.isNetworkError === true ||
    err?.isOffline === true ||
    err?.code === 'ERR_NETWORK' ||
    err?.message === 'Network Error' ||
    (typeof err?.message === 'string' && err.message.includes('Network request failed'));

  // This effect runs on mount to check for updated user data
  useEffect(() => {
    const bootstrapData = async () => {
        if (settings.currentUser) {
             try {
                // 1. Refresh User Profile to get latest role/storeId (skip if backend unreachable to avoid console noise)
                let freshUser = settings.currentUser;
                try {
                  const userResponse = await authApi.getProfile();
                  freshUser = userResponse.data;
                  setSetting('currentUser', freshUser);
                  localStorage.setItem('user', JSON.stringify(freshUser));
                } catch (profileErr: any) {
                  if (isNetworkError(profileErr)) {
                    if (process.env.NODE_ENV === 'development' && !(window as any).__bootstrapNetworkWarned) {
                      (window as any).__bootstrapNetworkWarned = true;
                      console.warn('[SettingsProvider] Backend not reachable. Using cached user and store.');
                    }
                    // Keep settings.currentUser; load store from IndexedDB below
                  } else {
                    throw profileErr;
                  }
                }

                // 2. Fetch Store if user has a storeId and save permanently
                if (freshUser?.storeId && storesApi?.getMyStore) {
                     try {
                        const { fetchAndSaveStore } = await import('@/lib/store-persistence');
                        const store = await fetchAndSaveStore(setSetting);
                        if (store) {
                            setSetting('currentStore', store);
                        }
                     } catch (error: any) {
                        if (isNetworkError(error)) {
                            const { loadStoreFromIndexedDB } = await import('@/lib/store-persistence');
                            const cachedStore = await loadStoreFromIndexedDB(freshUser!.storeId);
                            if (cachedStore) setSetting('currentStore', cachedStore);
                        } else if (process.env.NODE_ENV === 'development') {
                            console.warn('Failed to fetch store:', error);
                        }
                     }
                } else if (!settings.currentStore && storesApi?.getMyStore) {
                     try {
                        const { fetchAndSaveStore } = await import('@/lib/store-persistence');
                        const store = await fetchAndSaveStore(setSetting);
                        if (store) setSetting('currentStore', store);
                     } catch (e) {
                         if (isNetworkError(e)) {
                             const { loadStoreFromIndexedDB } = await import('@/lib/store-persistence');
                             const cachedStore = await loadStoreFromIndexedDB();
                             if (cachedStore) setSetting('currentStore', cachedStore);
                         }
                     }
                } else if (!settings.currentStore) {
                    const { loadStoreFromIndexedDB } = await import('@/lib/store-persistence');
                    const cachedStore = await loadStoreFromIndexedDB();
                    if (cachedStore) setSetting('currentStore', cachedStore);
                }
             } catch (error: any) {
                 if (!isNetworkError(error) && process.env.NODE_ENV === 'development') {
                     console.error('Failed to bootstrap app data:', error);
                 }
             }
        }
    };
    if (isInitialLoad) {
        bootstrapData();
    }
  }, [isInitialLoad, setSetting]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    try {
      // Persist theme and admin display prefs to localStorage
      window.localStorage.setItem('kasi-pos-settings', JSON.stringify({
        theme: settings.theme,
        showVatInCheckout: settings.showVatInCheckout,
      }));
      // Persist user explicitly as requested
      if (settings.currentUser) {
          window.localStorage.setItem('user', JSON.stringify(settings.currentUser));
      } else {
          window.localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Error saving settings to localStorage', error);
    }
  }, [settings]);

  useEffect(() => {
     if (typeof window !== 'undefined') {
        const inPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsPwa(inPwa);
    }
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    if (isInitialLoad) return;
    
    // Check if we are blocking due to missing store?
    // If db.stores is removed, currentStore is null.
    // If we return here, we block redirects.
    // Let's remove this block if we are moving away from local DB store.
    /* 
    if (settings.isLoggedIn && !settings.currentStore) {
        return; 
    }
    */

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isSetupRoute = pathname === SETUP_ROUTE;

    if (!settings.isLoggedIn && !isAuthRoute) {
      router.push('/login');
    } else if (settings.isLoggedIn) {
        // If we are logged in, we generally want to be in the app.
        // If store is missing, we might want to fetch it, but effectively we shouldn't stay on login.
        
        if (isAuthRoute) {
             router.push('/');
             return;
        }

        if (settings.currentStore) {
             if (!settings.currentStore.isSetupComplete && !isSetupRoute) {
                router.push(SETUP_ROUTE);
             } else if (settings.currentStore.isSetupComplete && isSetupRoute) {
                router.push('/');
             }
             
             // Role-based route protection: only admin can access /settings
             if ((settings.currentUser?.role === 'staff' || settings.currentUser?.role === 'store_admin') && pathname.startsWith('/settings')) {
                router.push('/');
             }
        }
    }
  }, [settings.isLoggedIn, settings.currentStore, settings.currentUser, pathname, router, isInitialLoad]);

  const login = useCallback(async (userData: User & { accessToken?: string }) => {
    if (userData.accessToken) {
        localStorage.setItem('token', userData.accessToken);
    }
    
    // Explicitly save user as well
    localStorage.setItem('user', JSON.stringify(userData));

    setSettings((prev) => ({ 
        ...prev,
        currentUser: userData,
        isLoggedIn: true,
        // currentStore: null // We don't have store details yet
    }));

    // Fetch and save store immediately after login
    try {
        const { fetchAndSaveStore } = await import('@/lib/store-persistence');
        const store = await fetchAndSaveStore(setSetting);
        if (store) {
            setSetting('currentStore', store);
        } else {
            // If fetch fails, try loading from IndexedDB
            const { loadStoreFromIndexedDB } = await import('@/lib/store-persistence');
            const cachedStore = await loadStoreFromIndexedDB(userData.storeId);
            if (cachedStore) {
                setSetting('currentStore', cachedStore);
            }
        }
    } catch (error: any) {
        // If network fails, try loading from IndexedDB
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            console.log('[SettingsProvider] Network error during login - loading store from IndexedDB');
            const { loadStoreFromIndexedDB } = await import('@/lib/store-persistence');
            const cachedStore = await loadStoreFromIndexedDB(userData.storeId);
            if (cachedStore) {
                setSetting('currentStore', cachedStore);
            }
        } else {
            console.warn('[SettingsProvider] Failed to fetch store after login:', error);
        }
    }
  }, [setSetting]);

  const canRenderChildren = () => {
    if (isInitialLoad) return false;
    if (!settings.isLoggedIn) return AUTH_ROUTES.includes(pathname);
    // if (!settings.currentStore) return false; // Don't block if store is missing for now
    if (settings.currentStore && !settings.currentStore.isSetupComplete) return pathname === SETUP_ROUTE;
    return !AUTH_ROUTES.includes(pathname) && pathname !== SETUP_ROUTE;
  };


  const value = { settings, setSetting, isPwa, logout, login };

  return <SettingsContext.Provider value={value}>
    {canRenderChildren() ? children : null}
  </SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
