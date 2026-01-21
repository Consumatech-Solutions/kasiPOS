
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
  login: (user: User) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  theme: 'light',
  language: 'en',
  campaigns: true,
  marketplace: true,
  boph: true,
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
    return { 
        ...defaultSettings, 
        theme: storedSettings.theme || 'light', 
        currentUser,
        isLoggedIn: !!currentUser
    };
  } catch (error) {
    console.error('Error reading settings from localStorage', error);
    return defaultSettings;
  }
}

const AUTH_ROUTES = ['/login', '/request-access', '/verify-code', '/set-password'];
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

  // This effect runs on mount to check for updated user data
  useEffect(() => {
    const bootstrapData = async () => {
        if (settings.currentUser) {
             try {
                // 1. Refresh User Profile to get latest role/storeId
                const userResponse = await authApi.getProfile();
                const freshUser = userResponse.data;
                
                // Update settings and localStorage with fresh user data
                setSetting('currentUser', freshUser);
                localStorage.setItem('user', JSON.stringify(freshUser));

                // 2. Fetch Store if user has a storeId
                if (freshUser.storeId && storesApi?.getMyStore) {
                     try {
                        const storeResponse = await storesApi.getMyStore();
                        const store = storeResponse.data;
                        setSetting('currentStore', store);
                     } catch (error: any) {
                        // Ignore errors if backend is not available
                        if (process.env.NODE_ENV === 'development' && error.code !== 'ERR_NETWORK') {
                            console.warn('Failed to fetch store:', error);
                        }
                     }
                } else if (!settings.currentStore && storesApi?.getMyStore) {
                     // Fallback check
                     try {
                        const storeResponse = await storesApi.getMyStore();
                        setSetting('currentStore', storeResponse.data);
                     } catch (e) {
                         // ignore
                     }
                }
             } catch (error: any) {
                 // Ne logger que les erreurs non-réseau en développement
                 if (process.env.NODE_ENV === 'development') {
                     if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                         // Erreur réseau attendue si le backend n'est pas démarré
                         console.warn('Backend non accessible. Mode hors ligne activé.');
                     } else {
                         console.error('Failed to bootstrap app data:', error);
                     }
                 }
                 // Continuer avec les données locales en cas d'erreur réseau
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
      // Persist only theme to localStorage
      window.localStorage.setItem('kasi-pos-settings', JSON.stringify({ theme: settings.theme }));
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
             
             // Role-based route protection for staff
             if (settings.currentUser?.role === 'staff' && pathname.startsWith('/settings')) {
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
  }, []);

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
